import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/thanh-toan-ncc — list payments with filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const ncc_id = searchParams.get("ncc_id") || "";
    const phieu_dat_hang_id = searchParams.get("phieu_dat_hang_id") || "";
    const from_date = searchParams.get("from_date") || "";
    const to_date = searchParams.get("to_date") || "";
    const phuong_thuc = searchParams.get("phuong_thuc") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("thanh_toan_ncc")
      .select(
        "*, nha_cung_cap(id, ma_ncc, ten_ncc), phieu_dat_hang(id, ma_phieu)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `ghi_chu.ilike.%${search}%,phuong_thuc.ilike.%${search}%`
      );
    }
    if (ncc_id) {
      query = query.eq("ncc_id", ncc_id);
    }
    if (phieu_dat_hang_id) {
      query = query.eq("phieu_dat_hang_id", phieu_dat_hang_id);
    }
    if (phuong_thuc) {
      query = query.eq("phuong_thuc", phuong_thuc);
    }
    if (from_date) {
      query = query.gte("ngay_thanh_toan", from_date);
    }
    if (to_date) {
      query = query.lte("ngay_thanh_toan", to_date);
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

// POST /api/wms/thanh-toan-ncc — create payment(s), supports single and batch
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Determine if batch or single
    const payments: Array<{
      ncc_id: string;
      phieu_dat_hang_id?: string;
      so_tien: number;
      ngay_thanh_toan: string;
      phuong_thuc: string;
      ghi_chu?: string;
    }> = body.batch && Array.isArray(body.batch) ? body.batch : [body];

    const insertData = payments.map((p) => ({
      ncc_id: p.ncc_id,
      phieu_dat_hang_id: p.phieu_dat_hang_id || null,
      so_tien: p.so_tien,
      ngay_thanh_toan: p.ngay_thanh_toan || new Date().toISOString(),
      phuong_thuc: p.phuong_thuc,
      ghi_chu: p.ghi_chu || null,
    }));

    const { data, error } = await supabase
      .from("thanh_toan_ncc")
      .insert(insertData)
      .select(
        "*, nha_cung_cap(id, ma_ncc, ten_ncc), phieu_dat_hang(id, ma_phieu)"
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return single object if single insert, array if batch
    const result = body.batch ? data : data[0];
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/wms/thanh-toan-ncc?id=UUID — delete a payment
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

    const { error } = await supabase
      .from("thanh_toan_ncc")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa thanh toán",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
