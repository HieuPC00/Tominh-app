import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/thu-mua/stats — aggregated purchase stats
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Total PO count
    const { count: total_po } = await supabase
      .from("phieu_dat_hang")
      .select("*", { count: "exact", head: true });

    // 2. Total debt: sum of tong_tien where trang_thai != 'huy'
    const { data: debtData } = await supabase
      .from("phieu_dat_hang")
      .select("tong_tien")
      .neq("trang_thai", "huy");

    const total_debt = (debtData || []).reduce(
      (sum: number, row: { tong_tien: number | null }) =>
        sum + (row.tong_tien || 0),
      0
    );

    // 3. Total paid: sum of all thanh_toan_ncc.so_tien
    const { data: paidData } = await supabase
      .from("thanh_toan_ncc")
      .select("so_tien");

    const total_paid = (paidData || []).reduce(
      (sum: number, row: { so_tien: number | null }) =>
        sum + (row.so_tien || 0),
      0
    );

    // 4. Outstanding
    const outstanding = total_debt - total_paid;

    // 5. Today's payments
    const today = new Date();
    const todayStr =
      today.getFullYear().toString() +
      "-" +
      (today.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      today.getDate().toString().padStart(2, "0");

    const { data: todayData } = await supabase
      .from("thanh_toan_ncc")
      .select("so_tien")
      .gte("ngay_thanh_toan", `${todayStr}T00:00:00`)
      .lte("ngay_thanh_toan", `${todayStr}T23:59:59`);

    const today_paid = (todayData || []).reduce(
      (sum: number, row: { so_tien: number | null }) =>
        sum + (row.so_tien || 0),
      0
    );

    return NextResponse.json({
      total_po: total_po ?? 0,
      total_debt,
      total_paid,
      outstanding,
      today_paid,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
