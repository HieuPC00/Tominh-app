import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/don-vi-tinh — list all units of measurement
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const trang_thai = searchParams.get("trang_thai") || "";

    let query = supabase
      .from("don_vi_tinh")
      .select("*")
      .order("ten_dvt", { ascending: true });

    if (search) {
      query = query.or(
        `ma_dvt.ilike.%${search}%,ten_dvt.ilike.%${search}%`
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

// DELETE /api/wms/don-vi-tinh?action=delete_all — delete all DVT records
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "delete_all") {
      const { error } = await supabase
        .from("don_vi_tinh")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Đã xóa tất cả đơn vị tính" });
    }

    return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
