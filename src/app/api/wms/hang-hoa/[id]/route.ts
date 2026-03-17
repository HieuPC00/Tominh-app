import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/hang-hoa/[id] — get single item
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("hang_hoa")
      .select(
        "*, don_vi_tinh(id, ma_dvt, ten_dvt), phan_loai_hh(id, ma_phan_loai, ten_phan_loai)"
      )
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/wms/hang-hoa/[id] — update item
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "ma_hang_hoa",
      "ten",
      "dvt_id",
      "phan_loai_id",
      "thuong_hieu",
      "nguon_goc",
      "quy_cach",
      "mo_ta",
      "dieu_kien_bao_quan",
      "nhiet_do_bao_quan",
      "han_su_dung_ngay",
      "phuong_phap_xuat",
      "ton_toi_thieu",
      "ton_toi_da",
      "bin_location_default",
      "trang_thai",
      "hinh_anh",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("hang_hoa")
      .update(updateData)
      .eq("id", id)
      .eq("is_deleted", false)
      .select(
        "*, don_vi_tinh(id, ma_dvt, ten_dvt), phan_loai_hh(id, ma_phan_loai, ten_phan_loai)"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/wms/hang-hoa/[id] — soft-delete item
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("hang_hoa")
      .update({ is_deleted: true })
      .eq("id", id)
      .select("id, ma_hang_hoa, ten")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
