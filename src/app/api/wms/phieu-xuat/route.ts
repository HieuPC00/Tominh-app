import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Generate issue code: PX-YYYYMMDD-NNN
async function generateMaPhieu(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");

  const prefix = `PX-${dateStr}-`;

  const { data } = await supabase
    .from("phieu_xuat")
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

  return `${prefix}${nextNum.toString().padStart(3, "0")}`;
}

// GET /api/wms/phieu-xuat — list all issues
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const kho_id = searchParams.get("kho_id") || "";
    const trang_thai = searchParams.get("trang_thai") || "";
    const loai_xuat = searchParams.get("loai_xuat") || "";
    const from_date = searchParams.get("from_date") || "";
    const to_date = searchParams.get("to_date") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("phieu_xuat")
      .select("*, kho_hang(id, ma_kho, ten_kho)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `ma_phieu.ilike.%${search}%,noi_nhan.ilike.%${search}%`
      );
    }
    if (kho_id) {
      query = query.eq("kho_id", kho_id);
    }
    if (trang_thai) {
      query = query.eq("trang_thai", trang_thai);
    }
    if (loai_xuat) {
      query = query.eq("loai_xuat", loai_xuat);
    }
    if (from_date) {
      query = query.gte("ngay_xuat", from_date);
    }
    if (to_date) {
      query = query.lte("ngay_xuat", to_date);
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

// POST /api/wms/phieu-xuat — create issue with items
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Generate ma_phieu
    const ma_phieu = await generateMaPhieu(supabase);

    // 1. Insert phieu_xuat header
    const { data: phieu, error: phieuError } = await supabase
      .from("phieu_xuat")
      .insert({
        ma_phieu,
        kho_id: body.kho_id,
        loai_xuat: body.loai_xuat || "su_dung",
        noi_nhan: body.noi_nhan || null,
        ngay_xuat: body.ngay_xuat || new Date().toISOString(),
        nguoi_xuat: body.nguoi_xuat || null,
        nguoi_nhan: body.nguoi_nhan || null,
        trang_thai: body.trang_thai || "nhap",
        ghi_chu: body.ghi_chu || null,
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
          hang_hoa_id: string;
          lot_id?: string;
          so_luong: number;
          don_gia_xuat?: number;
          ghi_chu?: string;
        }) => ({
          phieu_xuat_id: phieu.id,
          hang_hoa_id: item.hang_hoa_id,
          lot_id: item.lot_id || null,
          so_luong: item.so_luong,
          don_gia_xuat: item.don_gia_xuat || 0,
          ghi_chu: item.ghi_chu || null,
        })
      );

      const { error: itemsError } = await supabase
        .from("phieu_xuat_items")
        .insert(items);

      if (itemsError) {
        // Rollback: delete the header if items insertion fails
        await supabase.from("phieu_xuat").delete().eq("id", phieu.id);
        return NextResponse.json(
          { error: itemsError.message },
          { status: 400 }
        );
      }
    }

    // 3. Return phieu with items
    const { data: result, error: fetchError } = await supabase
      .from("phieu_xuat")
      .select("*, kho_hang(id, ma_kho, ten_kho), phieu_xuat_items(*, hang_hoa(id, ma_hang_hoa, ten))")
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
