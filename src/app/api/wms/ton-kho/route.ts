import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/wms/ton-kho — inventory summary grouped by kho + hang_hoa with alerts
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const kho_id = searchParams.get("kho_id") || "";
    const hang_hoa_id = searchParams.get("hang_hoa_id") || "";
    const search = searchParams.get("search") || "";
    const alert_only = searchParams.get("alert_only") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Fetch inventory lots with related data
    let query = supabase
      .from("inventory_lot")
      .select(
        "id, hang_hoa_id, kho_id, lot_number, ngay_nhap, ngay_san_xuat, ngay_het_han, so_luong_nhap, so_luong_ton, don_gia_nhap, trang_thai, hang_hoa(id, ma_hang_hoa, ten, ton_toi_thieu, ton_toi_da, don_vi_tinh(id, ma_dvt, ten_dvt), phan_loai_hh(id, ten_phan_loai)), kho_hang(id, ma_kho, ten_kho)"
      )
      .in("trang_thai", ["kha_dung", "canh_bao_hsd", "hold_qc"])
      .gt("so_luong_ton", 0);

    if (kho_id) {
      query = query.eq("kho_id", kho_id);
    }
    if (hang_hoa_id) {
      query = query.eq("hang_hoa_id", hang_hoa_id);
    }

    const { data: lots, error } = await query.order("kho_id").order("hang_hoa_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by kho_id + hang_hoa_id
    interface HangHoaRelation {
      id: string;
      ma_hang_hoa: string;
      ten: string;
      ton_toi_thieu: number;
      ton_toi_da: number;
      don_vi_tinh: { id: string; ma_dvt: string; ten_dvt: string } | null;
      phan_loai_hh: { id: string; ten_phan_loai: string } | null;
    }

    interface KhoHangRelation {
      id: string;
      ma_kho: string;
      ten_kho: string;
    }

    interface LotRow {
      id: string;
      hang_hoa_id: string;
      kho_id: string;
      lot_number: string;
      ngay_nhap: string;
      ngay_san_xuat: string | null;
      ngay_het_han: string | null;
      so_luong_nhap: number;
      so_luong_ton: number;
      don_gia_nhap: number;
      trang_thai: string;
      hang_hoa: HangHoaRelation;
      kho_hang: KhoHangRelation;
    }

    interface InventorySummary {
      kho_id: string;
      kho: KhoHangRelation;
      hang_hoa_id: string;
      hang_hoa: HangHoaRelation;
      tong_ton: number;
      gia_tri_ton: number;
      so_lot: number;
      ngay_het_han_gan_nhat: string | null;
      alerts: string[];
      lots: {
        id: string;
        lot_number: string;
        so_luong_ton: number;
        don_gia_nhap: number;
        ngay_het_han: string | null;
        trang_thai: string;
      }[];
    }

    const grouped: Record<string, InventorySummary> = {};
    const today = new Date();
    const warningDays = 7; // Alert if expiring within 7 days

    for (const lot of (lots || []) as unknown as LotRow[]) {
      const key = `${lot.kho_id}__${lot.hang_hoa_id}`;

      if (!grouped[key]) {
        grouped[key] = {
          kho_id: lot.kho_id,
          kho: lot.kho_hang,
          hang_hoa_id: lot.hang_hoa_id,
          hang_hoa: lot.hang_hoa,
          tong_ton: 0,
          gia_tri_ton: 0,
          so_lot: 0,
          ngay_het_han_gan_nhat: null,
          alerts: [],
          lots: [],
        };
      }

      const entry = grouped[key];
      const slTon = Number(lot.so_luong_ton);
      const donGia = Number(lot.don_gia_nhap);

      entry.tong_ton += slTon;
      entry.gia_tri_ton += slTon * donGia;
      entry.so_lot += 1;
      entry.lots.push({
        id: lot.id,
        lot_number: lot.lot_number,
        so_luong_ton: slTon,
        don_gia_nhap: donGia,
        ngay_het_han: lot.ngay_het_han,
        trang_thai: lot.trang_thai,
      });

      // Track nearest expiry
      if (lot.ngay_het_han) {
        if (
          !entry.ngay_het_han_gan_nhat ||
          lot.ngay_het_han < entry.ngay_het_han_gan_nhat
        ) {
          entry.ngay_het_han_gan_nhat = lot.ngay_het_han;
        }
      }
    }

    // Build alerts for each group
    let summaries = Object.values(grouped);

    for (const entry of summaries) {
      const tonMin = Number(entry.hang_hoa?.ton_toi_thieu || 0);
      const tonMax = Number(entry.hang_hoa?.ton_toi_da || 0);

      // Min stock alert
      if (tonMin > 0 && entry.tong_ton < tonMin) {
        entry.alerts.push(
          `Duoi_ton_toi_thieu: ${entry.tong_ton}/${tonMin}`
        );
      }

      // Max stock alert
      if (tonMax > 0 && entry.tong_ton > tonMax) {
        entry.alerts.push(
          `Vuot_ton_toi_da: ${entry.tong_ton}/${tonMax}`
        );
      }

      // Expiry alert
      if (entry.ngay_het_han_gan_nhat) {
        const expiryDate = new Date(entry.ngay_het_han_gan_nhat);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry < 0) {
          entry.alerts.push(`Da_het_han: ${entry.ngay_het_han_gan_nhat}`);
        } else if (daysUntilExpiry <= warningDays) {
          entry.alerts.push(
            `Sap_het_han: ${daysUntilExpiry} ngay (${entry.ngay_het_han_gan_nhat})`
          );
        }
      }
    }

    // Apply search filter on hang_hoa name/code
    if (search) {
      const lowerSearch = search.toLowerCase();
      summaries = summaries.filter(
        (s) =>
          s.hang_hoa?.ma_hang_hoa?.toLowerCase().includes(lowerSearch) ||
          s.hang_hoa?.ten?.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter alert_only
    if (alert_only) {
      summaries = summaries.filter((s) => s.alerts.length > 0);
    }

    // Pagination
    const total = summaries.length;
    const paged = summaries.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      total,
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
