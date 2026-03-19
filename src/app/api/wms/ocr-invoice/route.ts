import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

// Allow up to 60s for Groq Vision API call on Vercel
export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Build prompt for Vision model
function buildPrompt(
  nccList: { id: string; ma_ncc: string; ten_ncc: string; ma_so_thue: string | null }[],
  hhList: { id: string; ma_hang_hoa: string; ten: string; don_vi_tinh: { ten_dvt: string } | null; gia_binh_quan: number }[]
): string {
  const nccRows = nccList
    .map((n) => `${n.id} | ${n.ma_ncc} | ${n.ten_ncc} | ${n.ma_so_thue || ""}`)
    .join("\n");

  const hhRows = hhList
    .map((h) => `${h.id} | ${h.ma_hang_hoa} | ${h.ten} | ${h.don_vi_tinh?.ten_dvt || ""} | ${h.gia_binh_quan}`)
    .join("\n");

  return `Ban la he thong OCR chuyen doc hoa don/phieu nhap hang tieng Viet.

Hay doc hinh anh hoa don va trich xuat cac thong tin sau:

1. THONG TIN NHA CUNG CAP:
- Ten NCC (tren hoa don)
- Ma so thue (neu co)
- Dia chi (neu co)

2. DANH SACH HANG HOA (moi dong mot san pham):
- Ten hang hoa
- Don vi tinh
- So luong
- Don gia
- Thue VAT (% neu co)

3. THONG TIN KHAC:
- So hoa don
- Ngay hoa don
- Tong tien tren hoa don

QUAN TRONG: Hay doi chieu voi danh sach NCC va Hang hoa co san ben duoi de tim ket qua khop (match).
Neu ten NCC tren hoa don giong hoac tuong tu voi mot NCC trong danh sach, hay tra ve id cua NCC do.
Neu ten hang hoa tren hoa don giong hoac tuong tu voi mot hang hoa trong danh sach, hay tra ve id cua hang hoa do.
Uu tien match theo ma so thue neu co.

=== DANH SACH NCC CO SAN ===
id | ma_ncc | ten_ncc | ma_so_thue
${nccRows || "(Chua co NCC nao)"}

=== DANH SACH HANG HOA CO SAN ===
id | ma_hang_hoa | ten | don_vi_tinh | gia_binh_quan
${hhRows || "(Chua co hang hoa nao)"}

Tra ve KET QUA dang JSON voi cau truc nhu sau (KHONG co text khac ngoai JSON):
{
  "supplier": {
    "matched_id": "uuid hoac null",
    "ten_ncc": "ten tren hoa don",
    "ma_so_thue": "... hoac null",
    "dia_chi": "... hoac null"
  },
  "items": [
    {
      "matched_hang_hoa_id": "uuid hoac null",
      "ten_hang_hoa": "ten tren hoa don",
      "don_vi_tinh": "...",
      "so_luong": 0,
      "don_gia": 0,
      "vat_pct": 0
    }
  ],
  "invoice_info": {
    "so_hoa_don": "... hoac null",
    "ngay_hoa_don": "YYYY-MM-DD hoac null",
    "tong_tien": 0
  },
  "confidence": "high | medium | low",
  "notes": "bat ky ghi chu nao ve do chinh xac"
}`;
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

    // 3. Convert to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Data}`;

    // 4. Fetch NCC + HH from Supabase for context matching
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

    // 5. Call Groq Vision API (FREE - Llama 3.2 Vision)
    const groq = new Groq({ apiKey });

    let responseText: string | undefined;

    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
              {
                type: "text",
                text: buildPrompt(nccList, hhList),
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
        { error: "AI khong tra ve ket qua. Vui long thu lai voi anh ro hon." },
        { status: 500 }
      );
    }

    // 6. Parse JSON from response
    let parsed;
    try {
      let jsonStr = responseText.trim();
      // AI may wrap in ```json ... ```
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          error: "Khong the doc ket qua OCR. Vui long thu lai voi anh ro hon.",
          raw: responseText,
        },
        { status: 500 }
      );
    }

    // 7. Enrich with matched data from DB
    const result = {
      supplier: {
        matched_id: parsed.supplier?.matched_id || null,
        matched_ma_ncc: null as string | null,
        matched_ten_ncc: null as string | null,
        ocr_ten_ncc: parsed.supplier?.ten_ncc || "",
        ma_so_thue: parsed.supplier?.ma_so_thue || null,
        dia_chi: parsed.supplier?.dia_chi || null,
      },
      items: (parsed.items || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => ({
          matched_hang_hoa_id: item.matched_hang_hoa_id || null,
          matched_ten: null as string | null,
          matched_dvt: null as string | null,
          ocr_ten_hang_hoa: item.ten_hang_hoa || "",
          don_vi_tinh: item.don_vi_tinh || "",
          so_luong: Number(item.so_luong) || 0,
          don_gia: Number(item.don_gia) || 0,
          vat_pct: Number(item.vat_pct) || 0,
        })
      ),
      invoice_info: {
        so_hoa_don: parsed.invoice_info?.so_hoa_don || null,
        ngay_hoa_don: parsed.invoice_info?.ngay_hoa_don || null,
        tong_tien: Number(parsed.invoice_info?.tong_tien) || null,
      },
      confidence: parsed.confidence || "medium",
      notes: parsed.notes || null,
    };

    // Enrich supplier match
    if (result.supplier.matched_id) {
      const matchedNcc = nccList.find(
        (n) => n.id === result.supplier.matched_id
      );
      if (matchedNcc) {
        result.supplier.matched_ma_ncc = matchedNcc.ma_ncc;
        result.supplier.matched_ten_ncc = matchedNcc.ten_ncc;
      }
    }

    // Enrich product matches
    for (const item of result.items) {
      if (item.matched_hang_hoa_id) {
        const matchedHH = hhList.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (h: any) => h.id === item.matched_hang_hoa_id
        );
        if (matchedHH) {
          item.matched_ten = matchedHH.ten;
          item.matched_dvt = matchedHH.don_vi_tinh?.ten_dvt || null;
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("OCR Invoice error:", err);
    const message =
      err instanceof Error ? err.message : "Loi khong xac dinh";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
