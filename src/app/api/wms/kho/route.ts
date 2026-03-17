import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/kho — list all warehouses
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const trang_thai = searchParams.get("trang_thai") || "";
    const loai_kho = searchParams.get("loai_kho") || "";

    let query = supabase
      .from("kho_hang")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `ma_kho.ilike.%${search}%,ten_kho.ilike.%${search}%`
      );
    }
    if (trang_thai) {
      query = query.eq("trang_thai", trang_thai);
    }
    if (loai_kho) {
      query = query.eq("loai_kho", loai_kho);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, total: count ?? 0 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/wms/kho — create warehouse
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("kho_hang")
      .insert({
        ma_kho: body.ma_kho,
        ten_kho: body.ten_kho,
        loai_kho: body.loai_kho || "cua_hang",
        dia_chi: body.dia_chi || null,
        nguoi_quan_ly: body.nguoi_quan_ly || null,
        dien_thoai: body.dien_thoai || null,
        trang_thai: body.trang_thai || "hoat_dong",
      })
      .select()
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
