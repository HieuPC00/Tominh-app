import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

const OCR_PROMPT = `Ban la OCR doc hoa don mua hang tieng Viet. Doc anh va tra ve JSON.

QUY TAC:
- CHI lay dong SAN PHAM THUC SU (co ten + so luong hoac don gia).
- KHONG lay dong tieu de, tong cong, dong trong, ghi chu.
- Don gia la gia 1 don vi (KHONG phai thanh tien).
- Neu khong doc ro so luong/don gia, de = 0.
- Giu nguyen tieng Viet co dau.

Tra ve JSON (KHONG co text nao khac):
{
  "ncc": "ten nha cung cap hoac null",
  "mst": "ma so thue hoac null",
  "so_hd": "so hoa don hoac null",
  "ngay": "YYYY-MM-DD hoac null",
  "items": [
    {"ten": "ten san pham tieng Viet co dau", "dvt": "kg", "sl": 10, "gia": 50000, "vat": 0}
  ]
}`;

// Normalize for comparison ONLY (not for search)
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function sim(a: string, b: string): number {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = na.split(" ").filter(w => w.length >= 2);
  const wb = nb.split(" ").filter(w => w.length >= 2);
  if (!wa.length || !wb.length) return 0;
  let hits = 0;
  for (const a of wa) {
    for (const b of wb) {
      if (a === b || a.includes(b) || b.includes(a)) { hits++; break; }
    }
  }
  return hits / Math.max(wa.length, wb.length);
}

// Extract Vietnamese keywords (WITH diacritics) for Supabase ilike
function extractVietnameseKeywords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(w => w.length >= 2);
  return [...new Set(words)];
}

// Search product in Supabase and pick best match
async function searchProduct(
  supabase: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]> extends never ? never : Awaited<ReturnType<typeof createClient>>,
  ocrName: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const keywords = extractVietnameseKeywords(ocrName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = new Map<string, any>();

  // Strategy 1: Search with each ORIGINAL Vietnamese keyword (with diacritics)
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    try {
      const { data } = await supabase
        .from("hang_hoa")
        .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
        .eq("is_deleted", false)
        .or(`ten.ilike.%${kw}%,ma_hang_hoa.ilike.%${kw}%`)
        .limit(15);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) data.forEach((h: any) => candidates.set(h.id, h));
    } catch { /* ignore individual search errors */ }
  }

  // Strategy 2: Search with full OCR name
  try {
    const { data } = await supabase
      .from("hang_hoa")
      .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
      .eq("is_deleted", false)
      .ilike("ten", `%${ocrName}%`)
      .limit(10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data) data.forEach((h: any) => candidates.set(h.id, h));
  } catch { /* ignore */ }

  // Strategy 3: Search with FIRST 2-3 keywords combined
  if (keywords.length >= 2) {
    const combo = keywords.slice(0, 3).join(" ");
    try {
      const { data } = await supabase
        .from("hang_hoa")
        .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
        .eq("is_deleted", false)
        .ilike("ten", `%${combo}%`)
        .limit(10);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) data.forEach((h: any) => candidates.set(h.id, h));
    } catch { /* ignore */ }
  }

  if (candidates.size === 0) return null;

  // Pick best match by similarity score — require >= 0.3
  let bestScore = 0, bestProduct = null;
  for (const hh of candidates.values()) {
    const s = sim(ocrName, hh.ten);
    if (s > bestScore) { bestScore = s; bestProduct = hh; }
  }

  return bestScore >= 0.3 ? bestProduct : null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chua cau hinh GROQ_API_KEY" }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Khong co file" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Chi JPEG/PNG/WebP" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File > 5MB" }, { status: 400 });

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    // 1. Groq Vision — extract text from image
    const groq = new Groq({ apiKey });
    let text: string | undefined;
    try {
      const r = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } },
            { type: "text", text: OCR_PROMPT },
          ],
        }],
        max_tokens: 4096,
        temperature: 0.1,
      });
      text = r.choices?.[0]?.message?.content || undefined;
    } catch (err) {
      return NextResponse.json({ error: `Loi Groq: ${err instanceof Error ? err.message : err}` }, { status: 500 });
    }

    if (!text) return NextResponse.json({ error: "AI khong tra ve ket qua" }, { status: 500 });

    // 2. Parse JSON
    let raw;
    try {
      let j = text.trim();
      const m1 = j.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m1) j = m1[1].trim();
      const m2 = j.match(/\{[\s\S]*\}/);
      if (m2) j = m2[0];
      raw = JSON.parse(j);
    } catch {
      return NextResponse.json({ error: "Khong doc duoc JSON", raw: text.substring(0, 500) }, { status: 500 });
    }

    const supabase = await createClient();

    // 3. Match NCC
    const ocrNcc = (raw.ncc || "").trim();
    const ocrMst = (raw.mst || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedNcc: any = null;

    if (ocrMst) {
      const { data } = await supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc").eq("trang_thai", "hoat_dong").eq("ma_so_thue", ocrMst).limit(1);
      if (data?.length) matchedNcc = data[0];
    }
    if (!matchedNcc && ocrNcc) {
      const keywords = extractVietnameseKeywords(ocrNcc);
      for (const kw of keywords) {
        if (matchedNcc) break;
        const { data } = await supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc").eq("trang_thai", "hoat_dong").or(`ten_ncc.ilike.%${kw}%,ma_ncc.ilike.%${kw}%`).limit(5);
        if (data?.length) {
          let best = 0;
          for (const n of data) { const s = sim(ocrNcc, n.ten_ncc); if (s > best) { best = s; matchedNcc = n; } }
        }
      }
    }

    // 4. Match products — ONLY keep items that match a product in DB
    const rawItems = (raw.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => (i.ten || "").trim().length >= 2
    );

    const items = [];
    for (const i of rawItems) {
      const ocrName = (i.ten || "").trim();
      const matched = await searchProduct(supabase, ocrName);

      // CHI GIU LAI NEU MATCH DUOC SAN PHAM TRONG DB
      if (matched) {
        items.push({
          matched_hang_hoa_id: matched.id,
          matched_ten: matched.ten,                           // Ten tu DB (chinh xac)
          matched_dvt: matched.don_vi_tinh?.ten_dvt || null,  // DVT tu DB
          matched_gia: matched.gia_binh_quan || 0,            // Gia tu DB
          ocr_ten_hang_hoa: ocrName,                          // Ten OCR (de tham khao)
          don_vi_tinh: matched.don_vi_tinh?.ten_dvt || "",    // DVT tu DB
          so_luong: Math.max(0, Number(i.sl) || 0),           // SL tu OCR
          don_gia: Number(i.gia) > 0 ? Number(i.gia) : (matched.gia_binh_quan || 0), // Gia tu OCR, fallback DB
          vat_pct: Math.max(0, Number(i.vat) || 0),
        });
      }
    }

    return NextResponse.json({
      supplier: {
        matched_id: matchedNcc?.id || null,
        matched_ma_ncc: matchedNcc?.ma_ncc || null,
        matched_ten_ncc: matchedNcc?.ten_ncc || null,
        ocr_ten_ncc: ocrNcc,
        ma_so_thue: ocrMst || null,
      },
      items,
      total_ocr_items: rawItems.length,
      total_matched: items.length,
      invoice_info: {
        so_hoa_don: raw.so_hd || null,
        ngay_hoa_don: raw.ngay || null,
      },
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Loi" }, { status: 500 });
  }
}
