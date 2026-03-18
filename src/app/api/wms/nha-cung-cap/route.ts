import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("nha_cung_cap")
      .select("*", { count: "exact" })
      .eq("trang_thai", "hoat_dong")
      .order("ten_ncc")
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `ma_ncc.ilike.%${search}%,ten_ncc.ilike.%${search}%,ma_so_thue.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [], total: count ?? 0, page, limit });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("nha_cung_cap")
      .insert({
        ma_ncc: body.ma_ncc,
        ten_ncc: body.ten_ncc,
        dia_chi: body.dia_chi || null,
        ma_so_thue: body.ma_so_thue || null,
        dien_thoai: body.dien_thoai || null,
        email: body.email || null,
        nguoi_lien_he: body.nguoi_lien_he || null,
        ghi_chu: body.ghi_chu || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
