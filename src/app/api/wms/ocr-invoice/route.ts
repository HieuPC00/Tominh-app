import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase-server";

// Allow up to 60s for Gemini API call on Vercel
export const maxDuration = 60;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Build prompt for Gemini Vision
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

  return `Bạn là hệ thống OCR chuyên đọc hóa đơn/phiếu nhập hàng tiếng Việt.

Hãy đọc hình ảnh hóa đơn và trích xuất các thông tin sau:

1. THÔNG TIN NHÀ CUNG CẤP:
- Tên NCC (trên hóa đơn)
- Mã số thuế (nếu có)
- Địa chỉ (nếu có)

2. DANH SÁCH HÀNG HÓA (mỗi dòng một sản phẩm):
- Tên hàng hóa
- Đơn vị tính
- Số lượng
- Đơn giá
- Thuế VAT (% nếu có)

3. THÔNG TIN KHÁC:
- Số hóa đơn
- Ngày hóa đơn
- Tổng tiền trên hóa đơn

QUAN TRỌNG: Hãy đối chiếu với danh sách NCC và Hàng hóa có sẵn bên dưới để tìm kết quả khớp (match).
Nếu tên NCC trên hóa đơn giống hoặc tương tự với một NCC trong danh sách, hãy trả về id của NCC đó.
Nếu tên hàng hóa trên hóa đơn giống hoặc tương tự với một hàng hóa trong danh sách, hãy trả về id của hàng hóa đó.
Ưu tiên match theo mã số thuế nếu có.

=== DANH SÁCH NCC CÓ SẴN ===
id | ma_ncc | ten_ncc | ma_so_thue
${nccRows || "(Chưa có NCC nào)"}

=== DANH SÁCH HÀNG HÓA CÓ SẴN ===
id | ma_hang_hoa | ten | don_vi_tinh | gia_binh_quan
${hhRows || "(Chưa có hàng hóa nào)"}

Trả về KẾT QUẢ dạng JSON với cấu trúc như sau (KHÔNG có text khác ngoài JSON):
{
  "supplier": {
    "matched_id": "uuid hoặc null",
    "ten_ncc": "tên trên hóa đơn",
    "ma_so_thue": "... hoặc null",
    "dia_chi": "... hoặc null"
  },
  "items": [
    {
      "matched_hang_hoa_id": "uuid hoặc null",
      "ten_hang_hoa": "tên trên hóa đơn",
      "don_vi_tinh": "...",
      "so_luong": 0,
      "don_gia": 0,
      "vat_pct": 0
    }
  ],
  "invoice_info": {
    "so_hoa_don": "... hoặc null",
    "ngay_hoa_don": "YYYY-MM-DD hoặc null",
    "tong_tien": 0
  },
  "confidence": "high | medium | low",
  "notes": "bất kỳ ghi chú nào về độ chính xác"
}`;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY trên server" },
        { status: 500 }
      );
    }

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy file ảnh" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ file ảnh JPEG, PNG, hoặc WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File quá lớn. Giới hạn 5MB." },
        { status: 400 }
      );
    }

    // 3. Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

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

    // 5. Call Google Gemini Vision API
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(nccList, hhList);

    let responseText: string | undefined;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      });
      responseText = response.text;
    } catch (err) {
      console.error("Gemini API error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Loi Gemini: ${errMsg}` },
        { status: 500 }
      );
    }

    if (!responseText) {
      return NextResponse.json(
        { error: "Gemini khong tra ve ket qua. Vui long thu lai voi anh ro hon." },
        { status: 500 }
      );
    }

    // 7. Parse JSON from Gemini response
    let parsed;
    try {
      let jsonStr = responseText.trim();
      // Gemini may wrap in ```json ... ```
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          error: "Không thể đọc kết quả OCR. Vui lòng thử lại với ảnh rõ hơn.",
          raw: responseText,
        },
        { status: 500 }
      );
    }

    // 8. Enrich with matched data from DB
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
      err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
