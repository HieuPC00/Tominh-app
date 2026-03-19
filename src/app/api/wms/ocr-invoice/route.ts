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

// Strip diacritics for comparison
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Extract keywords (words >= 2 chars)
function keywords(s: string): string[] {
  return norm(s).split(" ").filter(w => w.length >= 2);
}

// BIDIRECTIONAL keyword matching:
// Score considers BOTH directions:
//   1. How many OCR words found in DB name (recall)
//   2. How many DB words are matched (precision) — penalizes DB names with many extra words
// Example: OCR "Bắp" vs DB "Bột bắp 150g" → recall=1.0 but precision=0.33 → score=0.53
// Example: OCR "Bắp" vs DB "Bắp"          → recall=1.0 AND precision=1.0 → score=1.0
function matchScore(ocrText: string, dbText: string): number {
  const a = norm(ocrText), b = norm(dbText);
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  const ocrWords = keywords(ocrText);
  const dbWords = keywords(dbText);
  if (!ocrWords.length || !dbWords.length) return 0;

  // Count OCR words found in DB (recall)
  let ocrHits = 0;
  const matchedDbIndices = new Set<number>();
  for (const ow of ocrWords) {
    let matched = false;
    for (let di = 0; di < dbWords.length; di++) {
      const dw = dbWords[di];
      if (dw === ow) { ocrHits += 1.0; matchedDbIndices.add(di); matched = true; break; }
      if (ow.length >= 3 && (dw.includes(ow) || ow.includes(dw))) {
        ocrHits += 0.8; matchedDbIndices.add(di); matched = true; break;
      }
    }
    // Substring in full name (weaker)
    if (!matched && ow.length >= 3 && b.includes(ow)) { ocrHits += 0.5; }
  }

  const recall = ocrHits / ocrWords.length;         // How much of OCR is covered
  const precision = matchedDbIndices.size / dbWords.length; // How much of DB name is covered

  // Weighted: recall matters more (0.5) but precision prevents false matches (0.5)
  // For short OCR like "Bắp":
  //   vs "Bắp" → 1.0*0.5 + 1.0*0.5 = 1.0
  //   vs "Bột bắp 150g" → 1.0*0.5 + 0.33*0.5 = 0.67
  //   vs "Bắp ngô" → 1.0*0.5 + 0.5*0.5 = 0.75
  return recall * 0.5 + precision * 0.5;
}

// Find best matching product — keyword-based, lenient
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestProduct(ocrName: string, products: any[], field = "ten"): { product: any; score: number } | null {
  if (!ocrName || ocrName.trim().length < 2) return null;

  let bestScore = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestProduct: any = null;

  for (const p of products) {
    const name = p[field] || "";
    const score = matchScore(ocrName, name);
    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  // Accept if at least 40% of OCR keywords found in DB name
  return bestScore >= 0.4 ? { product: bestProduct, score: bestScore } : null;
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

    // 3. Load ALL products + NCC from DB for matching
    const supabase = await createClient();
    const [nccRes, hhRes] = await Promise.all([
      supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc, ma_so_thue").eq("trang_thai", "hoat_dong").limit(2000),
      supabase.from("hang_hoa").select("id, ma_hang_hoa, ten, don_vi_tinh(ten_dvt), gia_binh_quan").eq("is_deleted", false).limit(5000),
    ]);

    if (hhRes.error) {
      console.error("Supabase hang_hoa error:", hhRes.error);
      return NextResponse.json({ error: `DB error: ${hhRes.error.message}` }, { status: 500 });
    }

    const nccList = nccRes.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allProducts = (hhRes.data || []) as any[];

    // 4. Match NCC
    const ocrNcc = (raw.ncc || "").trim();
    const ocrMst = (raw.mst || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedNcc: any = null;

    if (ocrMst) {
      matchedNcc = nccList.find(n => n.ma_so_thue && norm(n.ma_so_thue) === norm(ocrMst));
    }
    if (!matchedNcc && ocrNcc) {
      const result = findBestProduct(ocrNcc, nccList, "ten_ncc");
      if (result) matchedNcc = nccList.find(n => n.id === result.product.id);
    }

    // 5. Match each OCR item against ALL products — LENIENT matching
    const rawItems = (raw.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => (i.ten || "").trim().length >= 2
    );

    const items = [];
    for (const i of rawItems) {
      const ocrName = (i.ten || "").trim();
      const match = findBestProduct(ocrName, allProducts, "ten");

      if (match) {
        const p = match.product;
        items.push({
          matched_hang_hoa_id: p.id,
          matched_ten: p.ten,
          matched_dvt: p.don_vi_tinh?.ten_dvt || null,
          matched_gia: p.gia_binh_quan || 0,
          ocr_ten_hang_hoa: ocrName,
          don_vi_tinh: p.don_vi_tinh?.ten_dvt || "",
          so_luong: Math.max(0, Number(i.sl) || 0),
          don_gia: Number(i.gia) > 0 ? Number(i.gia) : (p.gia_binh_quan || 0),
          vat_pct: Math.max(0, Number(i.vat) || 0),
          match_score: Math.round(match.score * 100),
        });
      }
    }

    // DEBUG: show what OCR read vs what DB has for troubleshooting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debug_ocr_items = rawItems.map((i: any) => {
      const ocrName = (i.ten || "").trim();
      const match = findBestProduct(ocrName, allProducts, "ten");
      return {
        ocr: ocrName,
        best_match: match ? { name: match.product.ten, score: Math.round(match.score * 100) } : null,
      };
    });

    const debug_sample_products = allProducts.slice(0, 10).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.ten
    );

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
      total_products_in_db: allProducts.length,
      debug_ocr_items,
      debug_sample_products,
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
