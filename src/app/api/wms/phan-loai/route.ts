import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/phan-loai — list all item categories
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const trang_thai = searchParams.get("trang_thai") || "";

    let query = supabase
      .from("phan_loai_hh")
      .select("*")
      .order("ten_phan_loai", { ascending: true });

    if (search) {
      query = query.or(
        `ma_phan_loai.ilike.%${search}%,ten_phan_loai.ilike.%${search}%`
      );
    }
    if (trang_thai) {
      query = query.eq("trang_thai", trang_thai);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
