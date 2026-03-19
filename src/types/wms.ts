// WMS Types — Warehouse Management System

export type NhietDoBaoQuan = 'thuong' | 'mat' | 'lanh' | 'dong';
export type PhuongPhapXuat = 'FIFO' | 'FEFO' | 'chi_dinh';
export type TrangThaiChung = 'hoat_dong' | 'tam_khoa' | 'ngung';
export type LoaiKho = 'trung_tam' | 'cua_hang' | 'tam';
export type TrangThaiKho = 'hoat_dong' | 'bao_tri' | 'dong';
export type LoaiBin = 'ke_thuong' | 'tu_mat' | 'tu_dong' | 'khu_vuc_san';
export type TrangThaiLot = 'kha_dung' | 'hold_qc' | 'canh_bao_hsd' | 'het_hsd' | 'da_het' | 'da_huy';
export type LoaiNhap = 'tu_ncc' | 'chuyen_kho_den' | 'kiem_ke_thua' | 'khac';
export type LoaiXuat = 'su_dung' | 'chuyen_kho_di' | 'tra_ncc' | 'huy_hang' | 'kiem_ke_thieu' | 'khac';
export type TrangThaiPhieu = 'nhap' | 'cho_duyet' | 'da_xac_nhan' | 'huy';
export type TrangThaiChuyenKho = 'yeu_cau' | 'duyet' | 'dang_chuyen' | 'da_nhan' | 'huy';
export type LoaiKiemKe = 'toan_bo' | 'theo_phan_loai' | 'theo_vi_tri' | 'theo_hang_hoa';
export type TrangThaiKiemKe = 'nhap' | 'dang_dem' | 'hoan_tat' | 'da_dieu_chinh';
export type LyDoHuy = 'het_hsd' | 'hong' | 'loi_bao_quan' | 'kiem_ke_thieu' | 'khac';
export type TrangThaiHuy = 'cho_duyet' | 'da_huy' | 'tu_choi';

// Thu Mua (Purchase Management)
export type TrangThaiDatHang = 'cho_xac_nhan' | 'da_xac_nhan' | 'dang_giao' | 'da_nhan_hang' | 'da_thanh_toan' | 'huy';
export type PhuongThucThanhToan = 'chuyen_khoan' | 'tien_mat' | 'sec' | 'vi_dien_tu' | 'khac';

export interface DonViTinh {
  id: string;
  ma_dvt: string;
  ten_dvt: string;
  dv_mua: string | null;
  dv_su_dung: string | null;
  he_so_quy_doi: number;
  trang_thai: TrangThaiChung;
  created_at: string;
}

export interface PhanLoaiHH {
  id: string;
  ma_phan_loai: string;
  ten_phan_loai: string;
  thuoc_tinh: string;
  nhiet_do: NhietDoBaoQuan;
  trang_thai: TrangThaiChung;
  created_at: string;
}

export interface KhoHang {
  id: string;
  ma_kho: string;
  ten_kho: string;
  loai_kho: LoaiKho;
  dia_chi: string | null;
  nguoi_quan_ly: string | null;
  dien_thoai: string | null;
  trang_thai: TrangThaiKho;
  created_at: string;
  updated_at: string;
}

export interface BinLocation {
  id: string;
  kho_id: string;
  ma_vi_tri: string;
  ten_vi_tri: string | null;
  loai: LoaiBin;
  nhiet_do: NhietDoBaoQuan;
  suc_chua_max: number | null;
  dang_su_dung: number;
  trang_thai: TrangThaiKho;
  created_at: string;
}

export interface HangHoa {
  id: string;
  ma_hang_hoa: string;
  ten: string;
  dvt_id: string | null;
  phan_loai_id: string | null;
  thuong_hieu: string | null;
  nguon_goc: string | null;
  quy_cach: string | null;
  mo_ta: string | null;
  dieu_kien_bao_quan: string | null;
  nhiet_do_bao_quan: NhietDoBaoQuan;
  han_su_dung_ngay: number | null;
  phuong_phap_xuat: PhuongPhapXuat;
  ton_toi_thieu: number;
  ton_toi_da: number;
  gia_binh_quan: number;
  so_luong_ton: number;
  trang_thai: TrangThaiChung;
  hinh_anh: string | null;
  ma_qr: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  // Joined
  don_vi_tinh?: DonViTinh;
  phan_loai?: PhanLoaiHH;
}

export interface InventoryLot {
  id: string;
  hang_hoa_id: string;
  kho_id: string;
  bin_location_id: string | null;
  lot_number: string;
  ngay_nhap: string;
  ngay_san_xuat: string | null;
  ngay_het_han: string | null;
  so_luong_nhap: number;
  so_luong_ton: number;
  don_gia_nhap: number;
  phieu_nhap_id: string | null;
  trang_thai: TrangThaiLot;
  ghi_chu: string | null;
  created_at: string;
  // Joined
  hang_hoa?: HangHoa;
  kho?: KhoHang;
}

export interface PhieuNhap {
  id: string;
  ma_phieu: string;
  kho_id: string;
  loai_nhap: LoaiNhap;
  nguon: string | null;
  ngay_nhap: string;
  nguoi_nhap: string | null;
  nguoi_duyet: string | null;
  trang_thai: TrangThaiPhieu;
  ghi_chu: string | null;
  created_at: string;
  updated_at: string;
  phieu_dat_hang_id: string | null;
  // Joined
  kho?: KhoHang;
  items?: PhieuNhapItem[];
  phieu_dat_hang?: PhieuDatHang;
}

export interface PhieuNhapItem {
  id: string;
  phieu_nhap_id: string;
  hang_hoa_id: string;
  so_luong: number;
  don_vi_tinh: string | null;
  don_gia: number;
  lot_number: string | null;
  ngay_san_xuat: string | null;
  ngay_het_han: string | null;
  bin_location_id: string | null;
  ghi_chu: string | null;
  // Joined
  hang_hoa?: HangHoa;
}

export interface PhieuXuat {
  id: string;
  ma_phieu: string;
  kho_id: string;
  loai_xuat: LoaiXuat;
  noi_nhan: string | null;
  ngay_xuat: string;
  nguoi_xuat: string | null;
  nguoi_nhan: string | null;
  trang_thai: TrangThaiPhieu;
  ghi_chu: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  kho?: KhoHang;
  items?: PhieuXuatItem[];
}

export interface PhieuXuatItem {
  id: string;
  phieu_xuat_id: string;
  hang_hoa_id: string;
  lot_id: string | null;
  so_luong: number;
  don_gia_xuat: number;
  ghi_chu: string | null;
  // Joined
  hang_hoa?: HangHoa;
  lot?: InventoryLot;
}

export interface ChuyenKho {
  id: string;
  ma_phieu: string;
  kho_xuat_id: string;
  kho_nhan_id: string;
  ngay_tao: string;
  nguoi_tao: string | null;
  trang_thai: TrangThaiChuyenKho;
  ghi_chu: string | null;
  created_at: string;
  // Joined
  kho_xuat?: KhoHang;
  kho_nhan?: KhoHang;
}

export interface KiemKe {
  id: string;
  ma_phieu: string;
  kho_id: string;
  loai: LoaiKiemKe;
  ngay_kiem_ke: string;
  nguoi_kiem_ke: string | null;
  trang_thai: TrangThaiKiemKe;
  ghi_chu: string | null;
  created_at: string;
  // Joined
  kho?: KhoHang;
}

export interface NhaCungCap {
  id: string;
  ma_ncc: string;
  ten_ncc: string;
  dia_chi: string | null;
  ma_so_thue: string | null;
  dien_thoai: string | null;
  email: string | null;
  nguoi_lien_he: string | null;
  ghi_chu: string | null;
  trang_thai: TrangThaiChung;
  created_at: string;
  updated_at: string;
}

export interface HuyHang {
  id: string;
  ma_phieu: string;
  hang_hoa_id: string;
  lot_id: string;
  kho_id: string;
  so_luong_huy: number;
  gia_tri_huy: number;
  ly_do: LyDoHuy;
  mo_ta_ly_do: string | null;
  nguoi_tao: string | null;
  nguoi_duyet: string | null;
  trang_thai: TrangThaiHuy;
  ngay_huy: string | null;
  created_at: string;
  // Joined
  hang_hoa?: HangHoa;
  lot?: InventoryLot;
  kho?: KhoHang;
}

// ==================== THU MUA (PURCHASE MANAGEMENT) ====================

export interface PhieuDatHang {
  id: string;
  ma_phieu: string;
  ncc_id: string;
  ngay_dat: string;
  ngay_giao: string | null;
  trang_thai: TrangThaiDatHang;
  ghi_chu: string | null;
  so_hoa_don: string | null;
  tong_tien_hoa_don: number | null;
  subtotal: number;
  vat_amt: number;
  tong_tien: number;
  created_at: string;
  updated_at: string;
  // Joined
  nha_cung_cap?: NhaCungCap;
  items?: PhieuDatHangItem[];
}

export interface PhieuDatHangItem {
  id: string;
  phieu_dat_hang_id: string;
  hang_hoa_id: string | null;
  ten_hang_hoa: string;
  don_vi_tinh: string | null;
  so_luong: number;
  don_gia: number;
  vat_pct: number;
  ghi_chu: string | null;
  // Joined
  hang_hoa?: HangHoa;
}

export interface ThanhToanNCC {
  id: string;
  ncc_id: string;
  phieu_dat_hang_id: string | null;
  so_tien: number;
  ngay_thanh_toan: string;
  phuong_thuc: PhuongThucThanhToan;
  ghi_chu: string | null;
  created_at: string;
  // Joined
  nha_cung_cap?: NhaCungCap;
  phieu_dat_hang?: PhieuDatHang;
}
