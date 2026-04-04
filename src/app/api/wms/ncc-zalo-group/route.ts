import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("ncc_zalo_group")
      .select("*, nha_cung_cap(ma_ncc, ten_ncc)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0, page, limit });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Loi" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.ncc_id || !body.zalo_group_id) {
      return NextResponse.json({ error: "ncc_id va zalo_group_id la bat buoc" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ncc_zalo_group")
      .insert({
        ncc_id: body.ncc_id,
        zalo_group_id: body.zalo_group_id.trim(),
      })
      .select("*, nha_cung_cap(ma_ncc, ten_ncc)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Mapping nay da ton tai" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Loi" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thieu id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ncc_zalo_group")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Loi" }, { status: 500 });
  }
}
