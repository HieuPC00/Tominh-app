import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

// Prompt don gian: CHI doc text, KHONG match
const OCR_PROMPT = `Doc hoa don/phieu nhap hang tieng Viet trong anh. Tra ve JSON.

QUY TAC:
- CHI lay dong CO TEN SAN PHAM (bo dong tieu de, tong cong, ghi chu, dong trong).
- "ten": giu nguyen tieng Viet co dau nhu trong anh.
- "dvt": don vi tinh (kg, bich, trai, hop, cay, qua, bao...).
- "sl": so luong. Neu khong ro, de 0.
- "gia": don gia 1 don vi (KHONG phai thanh tien). Neu khong ro, de 0.

Tra ve DUNG JSON nay, KHONG co text khac:
{
  "ncc": "ten nha cung cap neu co, hoac null",
  "so_hd": "so hoa don neu co, hoac null",
  "ngay": "YYYY-MM-DD neu co, hoac null",
  "items": [
    {"ten": "Cai thao", "dvt": "kg", "sl": 5, "gia": 0}
  ]
}`;

// Strip diacritics for comparison
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Matching: CHI exact word match, dung F1 score, threshold 0.5
// "cu cai trang" vs "rau cu cai trang" → F1=0.857 ✅
// "cai thao" vs "trung bac thao" → F1=0.4 ✗ (rejected)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestMatch(ocrName: string, products: any[], field = "ten"): { product: any; score: number } | null {
  if (!ocrName || ocrName.trim().length < 2) return null;

  const ocrNorm = norm(ocrName);
  const ocrWords = ocrNorm.split(" ").filter(w => w.length >= 2);
  if (!ocrWords.length) return null;

  let bestScore = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestProduct: any = null;

  for (const p of products) {
    const dbName = p[field] || "";
    const dbNorm = norm(dbName);

    // Exact normalized match → perfect score
    if (ocrNorm === dbNorm) return { product: p, score: 1.0 };

    // One contains the other entirely → high score
    if (dbNorm.includes(ocrNorm) || ocrNorm.includes(dbNorm)) {
      const longer = Math.max(ocrNorm.length, dbNorm.length);
      const shorter = Math.min(ocrNorm.length, dbNorm.length);
      const s = 0.75 + 0.25 * (shorter / longer); // 0.75–1.0
      if (s > bestScore) { bestScore = s; bestProduct = p; }
      continue;
    }

    const dbWords = dbNorm.split(" ").filter(w => w.length >= 2);
    if (!dbWords.length) continue;

    // CHI exact word match — KHONG substring
    let ocrHits = 0;
    let dbHits = 0;

    for (const ow of ocrWords) {
      if (dbWords.includes(ow)) ocrHits++;
    }
    for (const dw of dbWords) {
      if (ocrWords.includes(dw)) dbHits++;
    }

    if (ocrHits === 0) continue;

    const recall = ocrHits / ocrWords.length;    // OCR words found in DB
    const precision = dbHits / dbWords.length;    // DB words found in OCR

    // F1 score (harmonic mean) — punishes partial matches harder
    const score = (2 * recall * precision) / (recall + precision);

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  return bestScore >= 0.5 ? { product: bestProduct, score: bestScore } : null;
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

    // 1. OCR: AI chi doc text tu anh, KHONG match
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

    // 3. Load products + NCC from DB
    const supabase = await createClient();
    const [nccRes, hhRes] = await Promise.all([
      supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc, ma_so_thue").eq("trang_thai", "hoat_dong").limit(2000),
      supabase.from("hang_hoa").select("id, ma_hang_hoa, ten, don_vi_tinh(ten_dvt), gia_binh_quan").or("is_deleted.eq.false,is_deleted.is.null").limit(5000),
    ]);

    if (hhRes.error) {
      return NextResponse.json({ error: `DB error: ${hhRes.error.message}` }, { status: 500 });
    }

    const nccList = nccRes.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allProducts = (hhRes.data || []) as any[];

    // 4. Match NCC
    const ocrNcc = (raw.ncc || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedNcc: any = null;
    if (ocrNcc) {
      matchedNcc = nccList.find(n => norm(n.ten_ncc) === norm(ocrNcc));
      if (!matchedNcc) {
        const m = findBestMatch(ocrNcc, nccList, "ten_ncc");
        if (m) matchedNcc = m.product;
      }
    }

    // 5. Match each OCR item against DB products
    const rawItems = (raw.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => (i.ten || "").trim().length >= 2
    );

    const items = [];
    const debugItems = [];

    for (const i of rawItems) {
      const ocrName = (i.ten || "").trim();
      const match = findBestMatch(ocrName, allProducts, "ten");

      debugItems.push({
        ocr: ocrName,
        matched: match ? { name: match.product.ten, score: Math.round(match.score * 100) } : null,
      });

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

    return NextResponse.json({
      supplier: {
        matched_id: matchedNcc?.id || null,
        matched_ma_ncc: matchedNcc?.ma_ncc || null,
        matched_ten_ncc: matchedNcc?.ten_ncc || null,
        ocr_ten_ncc: ocrNcc,
        ma_so_thue: null,
      },
      items,
      total_ocr_items: rawItems.length,
      total_matched: items.length,
      total_products_in_db: allProducts.length,
      debug_ocr_items: debugItems,
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
