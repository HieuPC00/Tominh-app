import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

// Allow up to 60s for Groq Vision API call on Vercel
export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// ===== SIMPLE PROMPT: Just extract data, NO matching =====
const OCR_PROMPT = `Doc hinh anh hoa don/phieu nhap hang tieng Viet.

Trich xuat CHINH XAC cac thong tin sau:

1. NHA CUNG CAP: ten, ma so thue, dia chi
2. HANG HOA: moi dong san pham gom: ten, don vi tinh, so luong, don gia, VAT%
3. So hoa don, ngay, tong tien

CHI trich xuat dong nao co TEN HANG HOA thuc su. Bo qua dong tong, dong trong, tieu de.

Tra ve JSON (KHONG co text khac):
{
  "supplier": {
    "ten_ncc": "...",
    "ma_so_thue": "... hoac null",
    "dia_chi": "... hoac null"
  },
  "items": [
    {
      "ten_hang_hoa": "ten chinh xac tren hoa don",
      "don_vi_tinh": "kg/goi/chai/...",
      "so_luong": 10,
      "don_gia": 50000,
      "vat_pct": 0
    }
  ],
  "invoice_info": {
    "so_hoa_don": "... hoac null",
    "ngay_hoa_don": "YYYY-MM-DD hoac null",
    "tong_tien": 0
  }
}`;

// ===== Fuzzy matching: normalize Vietnamese text =====
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarity score: ratio of matching words
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);

  // Exact match after normalize
  if (na === nb) return 1.0;

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Word overlap
  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  let matchCount = 0;
  for (const wa of wordsA) {
    if (wa.length < 2) continue;
    for (const wb of wordsB) {
      if (wb.length < 2 && wa === wb) { matchCount++; break; }
      if (wb.includes(wa) || wa.includes(wb)) { matchCount++; break; }
    }
  }
  const maxWords = Math.max(wordsA.length, wordsB.length);
  return maxWords > 0 ? matchCount / maxWords : 0;
}

// Find best match from a list
function findBestMatch<T extends { id: string }>(
  ocrText: string,
  list: T[],
  getNames: (item: T) => string[],
  threshold = 0.4
): T | null {
  if (!ocrText || ocrText.trim().length < 2) return null;

  let bestScore = 0;
  let bestItem: T | null = null;

  for (const item of list) {
    const names = getNames(item);
    for (const name of names) {
      if (!name) continue;
      const score = similarity(ocrText, name);
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  return bestScore >= threshold ? bestItem : null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chua cau hinh GROQ_API_KEY tren server" },
        { status: 500 }
      );
    }

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Khong tim thay file anh" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Chi ho tro file anh JPEG, PNG, hoac WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File qua lon. Gioi han 5MB." },
        { status: 400 }
      );
    }

    // 3. Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Data}`;

    // 4. Call Groq Vision — simple prompt, just extract text
    const groq = new Groq({ apiKey });

    let responseText: string | undefined;

    try {
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: OCR_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
      responseText = response.choices?.[0]?.message?.content || undefined;
    } catch (err) {
      console.error("Groq API error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Loi Groq: ${errMsg}` },
        { status: 500 }
      );
    }

    if (!responseText) {
      return NextResponse.json(
        { error: "AI khong tra ve ket qua. Thu lai voi anh ro hon." },
        { status: 500 }
      );
    }

    // 5. Parse JSON from AI response
    let parsed;
    try {
      let jsonStr = responseText.trim();
      // Strip markdown code block if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      // Try to find JSON object in response
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse OCR response:", responseText);
      return NextResponse.json(
        {
          error: "Khong the doc ket qua OCR. Thu lai voi anh ro hon.",
          raw: responseText.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // 6. Fetch NCC + HH from Supabase for FUZZY MATCHING
    const supabase = await createClient();

    const [nccRes, hhRes] = await Promise.all([
      supabase
        .from("nha_cung_cap")
        .select("id, ma_ncc, ten_ncc, ma_so_thue")
        .eq("trang_thai", "hoat_dong")
        .order("ten_ncc")
        .limit(2000),
      supabase
        .from("hang_hoa")
        .select("id, ma_hang_hoa, ten, don_vi_tinh:don_vi_tinh_table(ten_dvt), gia_binh_quan")
        .eq("is_deleted", false)
        .order("ten")
        .limit(5000),
    ]);

    const nccList = nccRes.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hhList = (hhRes.data || []) as any[];

    // 7. FUZZY MATCH supplier
    const ocrSupplierName = parsed.supplier?.ten_ncc || "";
    const ocrMST = parsed.supplier?.ma_so_thue || "";

    // Try MST match first (exact)
    let matchedNcc = ocrMST
      ? nccList.find(
          (n) => n.ma_so_thue && normalize(n.ma_so_thue) === normalize(ocrMST)
        )
      : null;

    // Fallback to fuzzy name match
    if (!matchedNcc && ocrSupplierName) {
      matchedNcc = findBestMatch(
        ocrSupplierName,
        nccList,
        (n) => [n.ten_ncc, n.ma_ncc],
        0.35
      );
    }

    // 8. FUZZY MATCH items + FILTER empty rows
    const rawItems = parsed.items || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validItems = rawItems.filter((item: any) => {
      const name = (item.ten_hang_hoa || "").trim();
      // Filter out items without a real product name
      if (name.length < 2) return false;
      return true;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedItems = validItems.map((item: any) => {
      const ocrName = (item.ten_hang_hoa || "").trim();
      const matchedHH = findBestMatch(
        ocrName,
        hhList,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (h: any) => [h.ten, h.ma_hang_hoa],
        0.35
      );

      return {
        matched_hang_hoa_id: matchedHH?.id || null,
        matched_ten: matchedHH?.ten || null,
        matched_dvt: matchedHH?.don_vi_tinh?.ten_dvt || null,
        ocr_ten_hang_hoa: ocrName,
        don_vi_tinh: item.don_vi_tinh || "",
        so_luong: Number(item.so_luong) || 0,
        don_gia: Number(item.don_gia) || 0,
        vat_pct: Number(item.vat_pct) || 0,
      };
    });

    // 9. Build result
    const result = {
      supplier: {
        matched_id: matchedNcc?.id || null,
        matched_ma_ncc: matchedNcc?.ma_ncc || null,
        matched_ten_ncc: matchedNcc?.ten_ncc || null,
        ocr_ten_ncc: ocrSupplierName,
        ma_so_thue: ocrMST || null,
        dia_chi: parsed.supplier?.dia_chi || null,
      },
      items: enrichedItems,
      invoice_info: {
        so_hoa_don: parsed.invoice_info?.so_hoa_don || null,
        ngay_hoa_don: parsed.invoice_info?.ngay_hoa_don || null,
        tong_tien: Number(parsed.invoice_info?.tong_tien) || null,
      },
      confidence: enrichedItems.length > 0 ? "medium" : "low",
      notes: `Doc duoc ${enrichedItems.length} san pham. NCC: ${matchedNcc ? "Da khop" : "Chua khop"}.`,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("OCR Invoice error:", err);
    const message =
      err instanceof Error ? err.message : "Loi khong xac dinh";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
