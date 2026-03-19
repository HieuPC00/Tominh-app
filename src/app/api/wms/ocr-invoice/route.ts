import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

// Strip diacritics for comparison
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestProduct(ocrName: string, products: any[]): any | null {
  if (!ocrName || ocrName.trim().length < 2) return null;
  const n = norm(ocrName);
  if (!n) return null;

  // Try exact normalized match first
  const exact = products.find(p => norm(p.ten) === n);
  if (exact) return exact;

  // Try: all OCR keywords found anywhere in product name
  const ocrWords = n.split(" ").filter(w => w.length >= 2);
  if (!ocrWords.length) return null;

  let bestScore = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestProduct: any = null;

  for (const p of products) {
    const pn = norm(p.ten);
    const pWords = pn.split(" ").filter(w => w.length >= 2);
    if (!pWords.length) continue;

    let hits = 0;
    const matchedDb = new Set<number>();
    for (const ow of ocrWords) {
      for (let di = 0; di < pWords.length; di++) {
        if (pWords[di] === ow) { hits++; matchedDb.add(di); break; }
        if (ow.length >= 3 && (pWords[di].includes(ow) || ow.includes(pWords[di]))) {
          hits += 0.8; matchedDb.add(di); break;
        }
      }
    }

    const recall = hits / ocrWords.length;
    const precision = matchedDb.size / pWords.length;
    const score = recall * 0.5 + precision * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  return bestScore >= 0.4 ? bestProduct : null;
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

    // 1. Load products + NCC from DB FIRST
    const supabase = await createClient();
    const [nccRes, hhRes] = await Promise.all([
      supabase.from("nha_cung_cap").select("id, ma_ncc, ten_ncc, ma_so_thue").eq("trang_thai", "hoat_dong").limit(2000),
      supabase.from("hang_hoa").select("id, ma_hang_hoa, ten, don_vi_tinh(ten_dvt), gia_binh_quan").eq("is_deleted", false).limit(5000),
    ]);

    if (hhRes.error) {
      return NextResponse.json({ error: `DB error: ${hhRes.error.message}` }, { status: 500 });
    }

    const nccList = nccRes.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allProducts = (hhRes.data || []) as any[];

    // 2. Build product name list for AI context (compact: just names)
    const productNames = allProducts.map(p => p.ten).filter(Boolean);
    const productListStr = productNames.join(", ");

    // 3. Build prompt WITH product list — AI matches handwriting against known names
    const prompt = `Ban la chuyen gia doc hoa don/phieu nhap hang tieng Viet (ca chu viet tay).
Doc anh va tra ve JSON voi cac san pham.

DANH MUC SAN PHAM DA BIET (hay chon ten CHINH XAC tu danh sach nay):
${productListStr}

QUY TAC QUAN TRONG:
1. Doc tung dong san pham tren anh.
2. Voi MOI dong, tim ten TUONG TU NHAT trong DANH MUC tren.
   - Vi du: chu viet tay "Bap" → chon "Bắp" tu danh muc.
   - Vi du: chu viet tay "nam kim cham" → chon "Rau nấm kim châm" tu danh muc.
   - Vi du: chu viet tay "cai thia" → chon "Rau cải thìa" tu danh muc.
   - Vi du: chu viet tay "gia" → chon "Rau giá" tu danh muc.
3. Truong "ten" PHAI la ten CHINH XAC copy tu danh muc, KHONG tu viet ten moi.
4. Neu khong tim thay ten tuong tu trong danh muc, bo qua dong do.
5. "sl" la so luong, "gia" la don gia 1 don vi (KHONG phai thanh tien). Neu khong doc ro, de = 0.
6. "dvt" la don vi tinh doc tu anh (kg, bich, trai, hop, cay...).

Tra ve JSON (KHONG co text nao khac):
{
  "ncc": "ten nha cung cap hoac null",
  "so_hd": "so hoa don hoac null",
  "ngay": "YYYY-MM-DD hoac null",
  "items": [
    {"ten": "ten CHINH XAC tu danh muc", "dvt": "kg", "sl": 10, "gia": 50000}
  ]
}`;

    // 4. Call Groq Vision with product list context
    const groq = new Groq({ apiKey });
    let text: string | undefined;
    try {
      const r = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } },
            { type: "text", text: prompt },
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

    // 5. Parse JSON
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

    // 6. Match NCC
    const ocrNcc = (raw.ncc || "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedNcc: any = null;
    if (ocrNcc) {
      // Exact or fuzzy match NCC
      matchedNcc = nccList.find(n => norm(n.ten_ncc) === norm(ocrNcc));
      if (!matchedNcc) {
        matchedNcc = nccList.find(n => norm(n.ten_ncc).includes(norm(ocrNcc)) || norm(ocrNcc).includes(norm(n.ten_ncc)));
      }
    }

    // 7. Match each item — AI already picked names from catalog, just find the DB record
    const rawItems = (raw.items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any) => (i.ten || "").trim().length >= 2
    );

    const items = [];
    for (const i of rawItems) {
      const aiName = (i.ten || "").trim();

      // AI should have returned exact DB name, try exact match first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let product: any = allProducts.find(p => norm(p.ten) === norm(aiName));

      // Fallback: fuzzy match
      if (!product) {
        product = findBestProduct(aiName, allProducts);
      }

      if (product) {
        items.push({
          matched_hang_hoa_id: product.id,
          matched_ten: product.ten,
          matched_dvt: product.don_vi_tinh?.ten_dvt || null,
          matched_gia: product.gia_binh_quan || 0,
          ocr_ten_hang_hoa: aiName,
          don_vi_tinh: product.don_vi_tinh?.ten_dvt || "",
          so_luong: Math.max(0, Number(i.sl) || 0),
          don_gia: Number(i.gia) > 0 ? Number(i.gia) : (product.gia_binh_quan || 0),
          vat_pct: Math.max(0, Number(i.vat) || 0),
          match_score: norm(product.ten) === norm(aiName) ? 100 : 80,
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
