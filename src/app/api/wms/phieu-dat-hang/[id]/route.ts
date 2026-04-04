import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Generate receipt code: PN-YYYYMMDD-NNN (for auto-creating phieu_nhap)
async function generateMaPhieuNhap(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");

  const prefix = `PN-${dateStr}-`;

  const { data } = await supabase
    .from("phieu_nhap")
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

// GET /api/wms/phieu-dat-hang/[id] — get single PO with items and NCC
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("phieu_dat_hang")
      .select(
        "*, nha_cung_cap(id, ma_ncc, ten_ncc, dien_thoai), phieu_dat_hang_items(*)"
      )
      .eq("id", id)
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

// PATCH /api/wms/phieu-dat-hang/[id] — update PO fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Fetch current PO to check status transitions
    const { data: currentPO, error: fetchCurrentError } = await supabase
      .from("phieu_dat_hang")
      .select("*, phieu_dat_hang_items(*)")
      .eq("id", id)
      .single();

    if (fetchCurrentError || !currentPO) {
      return NextResponse.json(
        { error: fetchCurrentError?.message || "Không tìm thấy phiếu đặt hàng" },
        { status: 404 }
      );
    }

    // If items array is provided, replace items and recalculate totals
    if (body.items && Array.isArray(body.items)) {
      // Delete old items
      await supabase
        .from("phieu_dat_hang_items")
        .delete()
        .eq("phieu_dat_hang_id", id);

      // Calculate new totals
      let subtotal = 0;
      let tong_tien = 0;

      const items = body.items.map(
        (item: {
          hang_hoa_id?: string;
          ten_hang_hoa: string;
          don_vi_tinh?: string;
          so_luong: number;
          don_gia: number;
          vat_pct?: number;
          ghi_chu?: string;
        }) => {
          const lineSubtotal = (item.so_luong || 0) * (item.don_gia || 0);
          const vatPct = item.vat_pct || 0;
          const lineTotal = lineSubtotal * (1 + vatPct / 100);
          subtotal += lineSubtotal;
          tong_tien += lineTotal;

          return {
            phieu_dat_hang_id: id,
            hang_hoa_id: item.hang_hoa_id || null,
            ten_hang_hoa: item.ten_hang_hoa,
            don_vi_tinh: item.don_vi_tinh || null,
            so_luong: item.so_luong,
            don_gia: item.don_gia,
            vat_pct: item.vat_pct || 0,
            ghi_chu: item.ghi_chu || null,
          };
        }
      );

      const vat_amt = tong_tien - subtotal;

      // Insert new items
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("phieu_dat_hang_items")
          .insert(items);

        if (itemsError) {
          return NextResponse.json(
            { error: itemsError.message },
            { status: 400 }
          );
        }
      }

      // Set calculated totals on update data
      body.subtotal = subtotal;
      body.vat_amt = vat_amt;
      body.tong_tien = tong_tien;
    }

    // Build update data for header (exclude items array)
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "trang_thai",
      "ngay_dat",
      "ngay_giao",
      "ghi_chu",
      "so_hoa_don",
      "tong_tien_hoa_don",
      "subtotal",
      "vat_amt",
      "tong_tien",
      "ncc_id",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // CRITICAL: Handle status change to 'da_nhan_hang' — auto-create phieu_nhap
    let createdPhieuNhap: { id: string; ma_phieu: string } | null = null;

    if (body.trang_thai === "da_nhan_hang") {
      if (!body.kho_id) {
        return NextResponse.json(
          { error: "kho_id là bắt buộc khi chuyển trạng thái sang 'da_nhan_hang'" },
          { status: 400 }
        );
      }

      // Generate phieu_nhap ma_phieu
      const maPhieuNhap = await generateMaPhieuNhap(supabase);

      // Create phieu_nhap record
      const { data: phieuNhap, error: pnError } = await supabase
        .from("phieu_nhap")
        .insert({
          ma_phieu: maPhieuNhap,
          kho_id: body.kho_id,
          loai_nhap: "tu_ncc",
          nguon: currentPO.ma_phieu,
          phieu_dat_hang_id: id,
          trang_thai: "nhap",
          ngay_nhap: new Date().toISOString(),
        })
        .select("id, ma_phieu")
        .single();

      if (pnError) {
        return NextResponse.json(
          { error: `Lỗi tạo phiếu nhập: ${pnError.message}` },
          { status: 500 }
        );
      }

      // Use the latest items (from body or from current PO)
      const sourceItems = body.items && Array.isArray(body.items)
        ? body.items
        : currentPO.phieu_dat_hang_items || [];

      if (sourceItems.length > 0) {
        const phieuNhapItems = sourceItems.map(
          (item: {
            hang_hoa_id?: string;
            so_luong: number;
            don_gia: number;
            don_vi_tinh?: string;
          }) => ({
            phieu_nhap_id: phieuNhap.id,
            hang_hoa_id: item.hang_hoa_id || null,
            so_luong: item.so_luong,
            don_gia: item.don_gia || 0,
            don_vi_tinh: item.don_vi_tinh || null,
          })
        );

        const { error: pnItemsError } = await supabase
          .from("phieu_nhap_items")
          .insert(phieuNhapItems);

        if (pnItemsError) {
          // Rollback: delete the phieu_nhap if items fail
          await supabase.from("phieu_nhap").delete().eq("id", phieuNhap.id);
          return NextResponse.json(
            { error: `Lỗi tạo chi tiết phiếu nhập: ${pnItemsError.message}` },
            { status: 500 }
          );
        }
      }

      createdPhieuNhap = phieuNhap;
    }

    // Update PO header
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("phieu_dat_hang")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 }
        );
      }
    }

    // Return updated PO with items and NCC
    const { data: result, error: fetchError } = await supabase
      .from("phieu_dat_hang")
      .select(
        "*, nha_cung_cap(id, ma_ncc, ten_ncc, dien_thoai), phieu_dat_hang_items(*)"
      )
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    const response: Record<string, unknown> = { ...result };
    if (createdPhieuNhap) {
      response.phieu_nhap = createdPhieuNhap;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/wms/phieu-dat-hang/[id] — delete PO by id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Delete items first
    await supabase
      .from("phieu_dat_hang_items")
      .delete()
      .eq("phieu_dat_hang_id", id);

    // Delete header
    const { error } = await supabase
      .from("phieu_dat_hang")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa phiếu đặt hàng",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
