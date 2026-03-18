import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/hang-hoa — list all items with search & filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const phan_loai = searchParams.get("phan_loai") || "";
    const kho = searchParams.get("kho") || "";
    const trang_thai = searchParams.get("trang_thai") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("hang_hoa")
      .select(
        "*, don_vi_tinh(id, ma_dvt, ten_dvt), phan_loai:phan_loai_hh(id, ma_phan_loai, ten_phan_loai)",
        { count: "exact" }
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `ma_hang_hoa.ilike.%${search}%,ten.ilike.%${search}%`
      );
    }
    if (phan_loai) {
      query = query.eq("phan_loai_id", phan_loai);
    }
    if (trang_thai) {
      query = query.eq("trang_thai", trang_thai);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If kho filter is provided, get inventory for each item in that warehouse
    let result = data;
    if (kho && data && data.length > 0) {
      const hangHoaIds = data.map((item) => item.id);
      const { data: lots } = await supabase
        .from("inventory_lot")
        .select("hang_hoa_id, so_luong_ton")
        .in("hang_hoa_id", hangHoaIds)
        .eq("kho_id", kho)
        .in("trang_thai", ["kha_dung", "canh_bao_hsd"]);

      const tonByHangHoa: Record<string, number> = {};
      if (lots) {
        for (const lot of lots) {
          tonByHangHoa[lot.hang_hoa_id] =
            (tonByHangHoa[lot.hang_hoa_id] || 0) +
            Number(lot.so_luong_ton);
        }
      }

      result = data.map((item) => ({
        ...item,
        ton_kho_tai_kho: tonByHangHoa[item.id] || 0,
      }));
    }

    return NextResponse.json({
      data: result,
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

// POST /api/wms/hang-hoa — create new item
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("hang_hoa")
      .insert({
        ma_hang_hoa: body.ma_hang_hoa,
        ten: body.ten,
        dvt_id: body.dvt_id || null,
        phan_loai_id: body.phan_loai_id || null,
        thuong_hieu: body.thuong_hieu || null,
        nguon_goc: body.nguon_goc || null,
        quy_cach: body.quy_cach || null,
        mo_ta: body.mo_ta || null,
        dieu_kien_bao_quan: body.dieu_kien_bao_quan || null,
        nhiet_do_bao_quan: body.nhiet_do_bao_quan || "thuong",
        han_su_dung_ngay: body.han_su_dung_ngay || null,
        phuong_phap_xuat: body.phuong_phap_xuat || "FIFO",
        ton_toi_thieu: body.ton_toi_thieu || 0,
        ton_toi_da: body.ton_toi_da || 0,
        bin_location_default: body.bin_location_default || null,
        hinh_anh: body.hinh_anh || null,
        created_by: body.created_by || null,
      })
      .select("*, don_vi_tinh(id, ma_dvt, ten_dvt), phan_loai:phan_loai_hh(id, ma_phan_loai, ten_phan_loai)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/wms/hang-hoa?action=delete_all — soft-delete all hang_hoa records
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "delete_all") {
      const { error } = await supabase
        .from("hang_hoa")
        .update({ is_deleted: true })
        .eq("is_deleted", false);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Đã xóa tất cả hàng hóa" });
    }

    return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
