import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

// ===== STRICT PROMPT — only real product lines =====
const OCR_PROMPT = `Ban la OCR doc hoa don mua hang tieng Viet. Doc anh va tra ve JSON.

QUY TAC QUAN TRONG:
- CHI lay dong nao la SAN PHAM THUC SU co ten + so luong + don gia.
- KHONG lay dong tieu de, dong tong cong, dong trong, dong ghi chu.
- Neu khong doc ro so luong hoac don gia, de gia tri = 0.
- Don gia la gia 1 don vi san pham (KHONG phai thanh tien).
- Neu hoa don viet tay kho doc, co gang doc tot nhat co the.

Tra ve CHINH XAC JSON nay (KHONG co text khac ngoai JSON):
{
  "ncc": "ten nha cung cap tren hoa don hoac null",
  "mst": "ma so thue hoac null",
  "so_hd": "so hoa don hoac null",
  "ngay": "YYYY-MM-DD hoac null",
  "items": [
    {"ten": "ten san pham", "dvt": "kg", "sl": 10, "gia": 50000, "vat": 0}
  ]
}`;

// ===== Normalize Vietnamese for fuzzy matching =====
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarity: word overlap ratio
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bestMatch(text: string, list: any[], getNames: (item: any) => string[], threshold = 0.3) {
  if (!text || text.trim().length < 2) return null;
  let best = 0, found = null;
  for (const item of list) {
    for (const name of getNames(item)) {
      if (!name) continue;
      const s = sim(text, name);
      if (s > best) { best = s; found = item; }
    }
  }
  return best >= threshold ? found : null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chua cau hinh GROQ_API_KEY" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Khong co file" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Chi JPEG/PNG/WebP" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File > 5MB" }, { status: 400 });

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    // Call Groq
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

    // Parse JSON
    let raw;
    try {
      let j = text.trim();
      const m1 = j.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m1) j = m1[1].trim();
      const m2 = j.match(/\{[\s\S]*\}/);
      if (m2) j = m2[0];
      raw = JSON.parse(j);
    } catch {
      return NextResponse.json({ error: "Khong doc duoc JSON tu AI", raw: text.substring(0, 500) }, { status: 500 });
    }

    // Fetch DB data for matching
    const supabase = await createClient();
    const [nccRes, hhRes] = await Promise.all([
      supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc, ma_so_thue").eq("trang_thai", "hoat_dong").limit(2000),
      supabase.from("hang_hoa").select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan").eq("is_deleted", false).limit(5000),
    ]);
    const nccList = nccRes.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hhList = (hhRes.data || []) as any[];

    // Match NCC — MST first, then fuzzy name
    const ocrNcc = raw.ncc || "";
    const ocrMst = raw.mst || "";
    let ncc = ocrMst ? nccList.find(n => n.ma_so_thue && norm(n.ma_so_thue) === norm(ocrMst)) : null;
    if (!ncc && ocrNcc) ncc = bestMatch(ocrNcc, nccList, n => [n.ten_ncc, n.ma_ncc]);

    // Match items — STRICT filter: must have ten >= 3 chars
    const items = (raw.items || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => {
        const name = (i.ten || "").trim();
        return name.length >= 3;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => {
        const name = (i.ten || "").trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hh = bestMatch(name, hhList, (h: any) => [h.ten, h.ma_hang_hoa]);
        return {
          matched_hang_hoa_id: hh?.id || null,
          matched_ten: hh?.ten || null,
          matched_dvt: hh?.don_vi_tinh?.ten_dvt || null,
          matched_gia: hh?.gia_binh_quan || null,
          ocr_ten_hang_hoa: name,
          don_vi_tinh: i.dvt || "",
          so_luong: Math.max(0, Number(i.sl) || 0),
          don_gia: Math.max(0, Number(i.gia) || 0),
          vat_pct: Math.max(0, Number(i.vat) || 0),
        };
      });

    return NextResponse.json({
      supplier: {
        matched_id: ncc?.id || null,
        matched_ma_ncc: ncc?.ma_ncc || null,
        matched_ten_ncc: ncc?.ten_ncc || null,
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
