import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Generate PO code: PO-YYMM-NNNN
async function generateMaPhieu(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const today = new Date();
  const yy = today.getFullYear().toString().slice(-2);
  const mm = (today.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `PO-${yy}${mm}-`;

  const { data } = await supabase
    .from("phieu_dat_hang")
    .select("ma_phieu")
    .like("ma_phieu", `${prefix}%`)
    .order("ma_phieu", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastCode = data[0].ma_phieu;
    const lastNum = parseInt(lastCode.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

// GET /api/wms/phieu-dat-hang — list purchase orders
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const ncc_id = searchParams.get("ncc_id") || "";
    const trang_thai = searchParams.get("trang_thai") || "";
    const from_date = searchParams.get("from_date") || "";
    const to_date = searchParams.get("to_date") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("phieu_dat_hang")
      .select("*, nha_cung_cap(id, ma_ncc, ten_ncc)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `ma_phieu.ilike.%${search}%,ghi_chu.ilike.%${search}%`
      );
    }
    if (ncc_id) {
      query = query.eq("ncc_id", ncc_id);
    }
    if (trang_thai) {
      query = query.eq("trang_thai", trang_thai);
    }
    if (from_date) {
      query = query.gte("ngay_dat", from_date);
    }
    if (to_date) {
      query = query.lte("ngay_dat", to_date);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count ?? 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/wms/phieu-dat-hang — create purchase order with items
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Generate ma_phieu
    const ma_phieu = await generateMaPhieu(supabase);

    // Calculate totals from items
    let subtotal = 0;
    let tong_tien = 0;

    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        const lineSubtotal = (item.so_luong || 0) * (item.don_gia || 0);
        const vatPct = item.vat_pct || 0;
        const lineTotal = lineSubtotal * (1 + vatPct / 100);
        subtotal += lineSubtotal;
        tong_tien += lineTotal;
      }
    }

    const vat_amt = tong_tien - subtotal;

    // 1. Insert phieu_dat_hang header
    const { data: phieu, error: phieuError } = await supabase
      .from("phieu_dat_hang")
      .insert({
        ma_phieu,
        ncc_id: body.ncc_id,
        ngay_dat: body.ngay_dat || new Date().toISOString(),
        ngay_giao: body.ngay_giao || null,
        ghi_chu: body.ghi_chu || null,
        subtotal,
        vat_amt,
        tong_tien,
        trang_thai: "nhap",
      })
      .select()
      .single();

    if (phieuError) {
      return NextResponse.json(
        { error: phieuError.message },
        { status: 400 }
      );
    }

    // 2. Insert items
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items.map(
        (item: {
          hang_hoa_id?: string;
          ten_hang_hoa: string;
          don_vi_tinh?: string;
          so_luong: number;
          don_gia: number;
          vat_pct?: number;
          ghi_chu?: string;
        }) => ({
          phieu_dat_hang_id: phieu.id,
          hang_hoa_id: item.hang_hoa_id || null,
          ten_hang_hoa: item.ten_hang_hoa,
          don_vi_tinh: item.don_vi_tinh || null,
          so_luong: item.so_luong,
          don_gia: item.don_gia,
          vat_pct: item.vat_pct || 0,
          ghi_chu: item.ghi_chu || null,
        })
      );

      const { error: itemsError } = await supabase
        .from("phieu_dat_hang_items")
        .insert(items);

      if (itemsError) {
        // Rollback: delete the header if items insertion fails
        await supabase.from("phieu_dat_hang").delete().eq("id", phieu.id);
        return NextResponse.json(
          { error: itemsError.message },
          { status: 400 }
        );
      }
    }

    // 3. Return PO with items and NCC join
    const { data: result, error: fetchError } = await supabase
      .from("phieu_dat_hang")
      .select(
        "*, nha_cung_cap(id, ma_ncc, ten_ncc), phieu_dat_hang_items(*)"
      )
      .eq("id", phieu.id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/wms/phieu-dat-hang?id=UUID — delete a purchase order (cascade deletes items)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    // Delete items first (in case no cascade on DB)
    await supabase
      .from("phieu_dat_hang_items")
      .delete()
      .eq("phieu_dat_hang_id", id);

    // Delete header
    const { error } = await supabase
      .from("phieu_dat_hang")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa phiếu đặt hàng",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
