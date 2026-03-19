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

Tra ve JSON (KHONG co text nao khac):
{
  "ncc": "ten nha cung cap hoac null",
  "mst": "ma so thue hoac null",
  "so_hd": "so hoa don hoac null",
  "ngay": "YYYY-MM-DD hoac null",
  "items": [
    {"ten": "ten san pham", "dvt": "kg", "sl": 10, "gia": 50000, "vat": 0}
  ]
}`;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Extract keywords from OCR text for Supabase ilike search
function extractKeywords(text: string): string[] {
  const n = norm(text);
  // Get words with length >= 2, take the most meaningful ones
  const words = n.split(" ").filter(w => w.length >= 2);
  // Return unique keywords (max 4 most important)
  return [...new Set(words)].slice(0, 4);
}

// Similarity score for ranking Supabase results
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

    // 1. Call Groq Vision — extract raw data from image
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
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Loi Groq: ${msg}` }, { status: 500 });
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

    // 3. Init Supabase
    const supabase = await createClient();

    // 4. Match NCC — search in Supabase (same as autocomplete)
    const ocrNcc = (raw.ncc || "").trim();
    const ocrMst = (raw.mst || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedNcc: any = null;

    if (ocrMst) {
      // Exact MST match
      const { data } = await supabase
        .from("nha_cung_cap")
        .select("id, ma_ncc, ten_ncc, ma_so_thue")
        .eq("trang_thai", "hoat_dong")
        .eq("ma_so_thue", ocrMst)
        .limit(1);
      if (data?.length) matchedNcc = data[0];
    }

    if (!matchedNcc && ocrNcc) {
      // Supabase ilike search for NCC name
      const keywords = extractKeywords(ocrNcc);
      for (const kw of keywords) {
        if (matchedNcc) break;
        const { data } = await supabase
          .from("nha_cung_cap")
          .select("id, ma_ncc, ten_ncc, ma_so_thue")
          .eq("trang_thai", "hoat_dong")
          .or(`ten_ncc.ilike.%${kw}%,ma_ncc.ilike.%${kw}%`)
          .limit(5);
        if (data?.length) {
          // Pick best match by similarity score
          let bestScore = 0;
          for (const n of data) {
            const s = sim(ocrNcc, n.ten_ncc);
            if (s > bestScore) { bestScore = s; matchedNcc = n; }
          }
        }
      }
    }

    // 5. Match each product — Supabase ilike search (same method as ProductAutocomplete)
    const rawItems = (raw.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => (i.ten || "").trim().length >= 3
    );

    const items = [];
    for (const i of rawItems) {
      const ocrName = (i.ten || "").trim();
      const keywords = extractKeywords(ocrName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bestProduct: any = null;
      let bestScore = 0;

      // Try each keyword as ilike search (same as autocomplete API)
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        const { data } = await supabase
          .from("hang_hoa")
          .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
          .eq("is_deleted", false)
          .or(`ma_hang_hoa.ilike.%${kw}%,ten.ilike.%${kw}%`)
          .limit(10);

        if (data?.length) {
          for (const hh of data) {
            const s = sim(ocrName, hh.ten);
            if (s > bestScore) {
              bestScore = s;
              bestProduct = hh;
            }
          }
        }
      }

      // Also try full OCR name as search
      if (!bestProduct || bestScore < 0.5) {
        const { data } = await supabase
          .from("hang_hoa")
          .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
          .eq("is_deleted", false)
          .or(`ten.ilike.%${ocrName}%,ma_hang_hoa.ilike.%${ocrName}%`)
          .limit(5);

        if (data?.length) {
          for (const hh of data) {
            const s = sim(ocrName, hh.ten);
            if (s > bestScore) {
              bestScore = s;
              bestProduct = hh;
            }
          }
        }
      }

      items.push({
        matched_hang_hoa_id: bestProduct?.id || null,
        matched_ten: bestProduct?.ten || null,
        matched_dvt: bestProduct?.don_vi_tinh?.ten_dvt || null,
        matched_gia: bestProduct?.gia_binh_quan || null,
        ocr_ten_hang_hoa: ocrName,
        don_vi_tinh: i.dvt || "",
        so_luong: Math.max(0, Number(i.sl) || 0),
        don_gia: Math.max(0, Number(i.gia) || 0),
        vat_pct: Math.max(0, Number(i.vat) || 0),
      });
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
