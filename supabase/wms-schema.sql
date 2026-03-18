-- ============================================================
-- Tominh WMS — Warehouse Management Schema
-- Multi-warehouse for 10+ F&B stores
-- ============================================================

-- 1. ENUMS
-- ------------------------------------------------------------

CREATE TYPE nhiet_do_bao_quan AS ENUM ('thuong', 'mat', 'lanh', 'dong');
CREATE TYPE phuong_phap_xuat AS ENUM ('FIFO', 'FEFO', 'chi_dinh');
CREATE TYPE trang_thai_chung AS ENUM ('hoat_dong', 'tam_khoa', 'ngung');
CREATE TYPE loai_kho AS ENUM ('trung_tam', 'cua_hang', 'tam');
CREATE TYPE trang_thai_kho AS ENUM ('hoat_dong', 'bao_tri', 'dong');
CREATE TYPE loai_bin AS ENUM ('ke_thuong', 'tu_mat', 'tu_dong', 'khu_vuc_san');
CREATE TYPE trang_thai_lot AS ENUM ('kha_dung', 'hold_qc', 'canh_bao_hsd', 'het_hsd', 'da_het', 'da_huy');
CREATE TYPE loai_nhap AS ENUM ('tu_ncc', 'chuyen_kho_den', 'kiem_ke_thua', 'khac');
CREATE TYPE loai_xuat AS ENUM ('su_dung', 'chuyen_kho_di', 'tra_ncc', 'huy_hang', 'kiem_ke_thieu', 'khac');
CREATE TYPE trang_thai_phieu AS ENUM ('nhap', 'cho_duyet', 'da_xac_nhan', 'huy');
CREATE TYPE trang_thai_chuyen_kho AS ENUM ('yeu_cau', 'duyet', 'dang_chuyen', 'da_nhan', 'huy');
CREATE TYPE loai_kiem_ke AS ENUM ('toan_bo', 'theo_phan_loai', 'theo_vi_tri', 'theo_hang_hoa');
CREATE TYPE trang_thai_kiem_ke AS ENUM ('nhap', 'dang_dem', 'hoan_tat', 'da_dieu_chinh');
CREATE TYPE xu_ly_kiem_ke AS ENUM ('chua_xu_ly', 'dieu_chinh_tang', 'dieu_chinh_giam', 'tao_phieu_huy');
CREATE TYPE ly_do_huy AS ENUM ('het_hsd', 'hong', 'loi_bao_quan', 'kiem_ke_thieu', 'khac');
CREATE TYPE trang_thai_huy AS ENUM ('cho_duyet', 'da_huy', 'tu_choi');

-- 2. TABLES
-- ------------------------------------------------------------

-- Đơn vị tính
CREATE TABLE don_vi_tinh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_dvt VARCHAR(20) NOT NULL UNIQUE,
  ten_dvt VARCHAR(50) NOT NULL,
  dv_mua VARCHAR(30),
  dv_su_dung VARCHAR(30),
  he_so_quy_doi DECIMAL(10,4) DEFAULT 1,
  trang_thai trang_thai_chung NOT NULL DEFAULT 'hoat_dong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phân loại hàng hóa
CREATE TABLE phan_loai_hh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phan_loai VARCHAR(20) NOT NULL UNIQUE,
  ten_phan_loai VARCHAR(100) NOT NULL,
  thuoc_tinh VARCHAR(50) NOT NULL DEFAULT 'khac',
  nhiet_do nhiet_do_bao_quan DEFAULT 'thuong',
  trang_thai trang_thai_chung NOT NULL DEFAULT 'hoat_dong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kho hàng (Warehouse)
CREATE TABLE kho_hang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_kho VARCHAR(20) NOT NULL UNIQUE,
  ten_kho VARCHAR(100) NOT NULL,
  loai_kho loai_kho NOT NULL DEFAULT 'cua_hang',
  dia_chi TEXT,
  nguoi_quan_ly UUID REFERENCES profiles(id) ON DELETE SET NULL,
  dien_thoai VARCHAR(20),
  trang_thai trang_thai_kho NOT NULL DEFAULT 'hoat_dong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vị trí kho (Bin Location)
CREATE TABLE bin_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kho_id UUID NOT NULL REFERENCES kho_hang(id) ON DELETE CASCADE,
  ma_vi_tri VARCHAR(30) NOT NULL,
  ten_vi_tri VARCHAR(100),
  loai loai_bin NOT NULL DEFAULT 'ke_thuong',
  nhiet_do nhiet_do_bao_quan DEFAULT 'thuong',
  suc_chua_max DECIMAL(15,3),
  dang_su_dung DECIMAL(15,3) DEFAULT 0,
  trang_thai trang_thai_kho NOT NULL DEFAULT 'hoat_dong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kho_id, ma_vi_tri)
);

-- Hàng hóa (Nguyên liệu / TBDC)
CREATE TABLE hang_hoa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_hang_hoa VARCHAR(30) NOT NULL UNIQUE,
  ten VARCHAR(255) NOT NULL,
  dvt_id UUID REFERENCES don_vi_tinh(id),
  phan_loai_id UUID REFERENCES phan_loai_hh(id),
  thuong_hieu VARCHAR(100),
  nguon_goc VARCHAR(100),
  quy_cach VARCHAR(200),
  mo_ta TEXT,
  dieu_kien_bao_quan VARCHAR(200),
  nhiet_do_bao_quan nhiet_do_bao_quan DEFAULT 'thuong',
  han_su_dung_ngay INT,
  phuong_phap_xuat phuong_phap_xuat NOT NULL DEFAULT 'FIFO',
  ton_toi_thieu DECIMAL(15,3) DEFAULT 0,
  ton_toi_da DECIMAL(15,3) DEFAULT 0,
  bin_location_default UUID REFERENCES bin_location(id),
  gia_binh_quan DECIMAL(15,2) DEFAULT 0,
  so_luong_ton DECIMAL(15,3) DEFAULT 0,
  trang_thai trang_thai_chung NOT NULL DEFAULT 'hoat_dong',
  hinh_anh TEXT,
  ma_qr VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Lô hàng (Inventory Lot) — BẢNG CỐT LÕI
CREATE TABLE inventory_lot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  kho_id UUID NOT NULL REFERENCES kho_hang(id),
  bin_location_id UUID REFERENCES bin_location(id),
  lot_number VARCHAR(50) NOT NULL,
  ngay_nhap DATE NOT NULL DEFAULT CURRENT_DATE,
  ngay_san_xuat DATE,
  ngay_het_han DATE,
  so_luong_nhap DECIMAL(15,3) NOT NULL,
  so_luong_ton DECIMAL(15,3) NOT NULL,
  don_gia_nhap DECIMAL(15,2) NOT NULL DEFAULT 0,
  phieu_nhap_id UUID,
  trang_thai trang_thai_lot NOT NULL DEFAULT 'kha_dung',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT so_luong_ton_khong_am CHECK (so_luong_ton >= 0)
);

-- Phiếu nhập kho
CREATE TABLE phieu_nhap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  kho_id UUID NOT NULL REFERENCES kho_hang(id),
  loai_nhap loai_nhap NOT NULL DEFAULT 'tu_ncc',
  nguon VARCHAR(255),
  ngay_nhap TIMESTAMPTZ NOT NULL DEFAULT now(),
  nguoi_nhap UUID REFERENCES profiles(id),
  nguoi_duyet UUID REFERENCES profiles(id),
  trang_thai trang_thai_phieu NOT NULL DEFAULT 'nhap',
  ghi_chu TEXT,
  anh_chung_tu TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chi tiết phiếu nhập
CREATE TABLE phieu_nhap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phieu_nhap_id UUID NOT NULL REFERENCES phieu_nhap(id) ON DELETE CASCADE,
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  so_luong DECIMAL(15,3) NOT NULL,
  don_vi_tinh VARCHAR(30),
  don_gia DECIMAL(15,2) NOT NULL DEFAULT 0,
  lot_number VARCHAR(50),
  ngay_san_xuat DATE,
  ngay_het_han DATE,
  bin_location_id UUID REFERENCES bin_location(id),
  ghi_chu TEXT
);

-- Phiếu xuất kho
CREATE TABLE phieu_xuat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  kho_id UUID NOT NULL REFERENCES kho_hang(id),
  loai_xuat loai_xuat NOT NULL DEFAULT 'su_dung',
  noi_nhan VARCHAR(255),
  ngay_xuat TIMESTAMPTZ NOT NULL DEFAULT now(),
  nguoi_xuat UUID REFERENCES profiles(id),
  nguoi_nhan UUID REFERENCES profiles(id),
  trang_thai trang_thai_phieu NOT NULL DEFAULT 'nhap',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chi tiết phiếu xuất
CREATE TABLE phieu_xuat_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phieu_xuat_id UUID NOT NULL REFERENCES phieu_xuat(id) ON DELETE CASCADE,
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  lot_id UUID REFERENCES inventory_lot(id),
  so_luong DECIMAL(15,3) NOT NULL,
  don_gia_xuat DECIMAL(15,2) DEFAULT 0,
  ghi_chu TEXT
);

-- Chuyển kho
CREATE TABLE chuyen_kho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  kho_xuat_id UUID NOT NULL REFERENCES kho_hang(id),
  kho_nhan_id UUID NOT NULL REFERENCES kho_hang(id),
  ngay_tao TIMESTAMPTZ NOT NULL DEFAULT now(),
  nguoi_tao UUID REFERENCES profiles(id),
  trang_thai trang_thai_chuyen_kho NOT NULL DEFAULT 'yeu_cau',
  phieu_xuat_id UUID REFERENCES phieu_xuat(id),
  phieu_nhap_id UUID REFERENCES phieu_nhap(id),
  ghi_chu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chi tiết chuyển kho
CREATE TABLE chuyen_kho_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chuyen_kho_id UUID NOT NULL REFERENCES chuyen_kho(id) ON DELETE CASCADE,
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  lot_id UUID REFERENCES inventory_lot(id),
  so_luong DECIMAL(15,3) NOT NULL,
  ghi_chu TEXT
);

-- Kiểm kê
CREATE TABLE kiem_ke (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  kho_id UUID NOT NULL REFERENCES kho_hang(id),
  loai loai_kiem_ke NOT NULL DEFAULT 'toan_bo',
  ngay_kiem_ke DATE NOT NULL DEFAULT CURRENT_DATE,
  nguoi_kiem_ke UUID REFERENCES profiles(id),
  trang_thai trang_thai_kiem_ke NOT NULL DEFAULT 'nhap',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chi tiết kiểm kê
CREATE TABLE kiem_ke_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiem_ke_id UUID NOT NULL REFERENCES kiem_ke(id) ON DELETE CASCADE,
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  lot_id UUID REFERENCES inventory_lot(id),
  sl_so_sach DECIMAL(15,3) DEFAULT 0,
  sl_thuc_te DECIMAL(15,3) DEFAULT 0,
  chenh_lech DECIMAL(15,3) DEFAULT 0,
  ly_do TEXT,
  xu_ly xu_ly_kiem_ke NOT NULL DEFAULT 'chua_xu_ly'
);

-- Hủy hàng
CREATE TABLE huy_hang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  hang_hoa_id UUID NOT NULL REFERENCES hang_hoa(id),
  lot_id UUID NOT NULL REFERENCES inventory_lot(id),
  kho_id UUID NOT NULL REFERENCES kho_hang(id),
  so_luong_huy DECIMAL(15,3) NOT NULL,
  gia_tri_huy DECIMAL(15,2) DEFAULT 0,
  ly_do ly_do_huy NOT NULL DEFAULT 'khac',
  mo_ta_ly_do TEXT,
  anh_minh_chung TEXT[],
  nguoi_tao UUID REFERENCES profiles(id),
  nguoi_duyet UUID REFERENCES profiles(id),
  trang_thai trang_thai_huy NOT NULL DEFAULT 'cho_duyet',
  ngay_huy TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nhà cung cấp
CREATE TABLE nha_cung_cap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_ncc VARCHAR(50) NOT NULL UNIQUE,
  ten_ncc VARCHAR(255) NOT NULL,
  dia_chi TEXT,
  ma_so_thue VARCHAR(50),
  dien_thoai VARCHAR(30),
  email VARCHAR(100),
  nguoi_lien_he VARCHAR(100),
  ghi_chu TEXT,
  trang_thai trang_thai_chung NOT NULL DEFAULT 'hoat_dong',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
-- ------------------------------------------------------------

CREATE INDEX idx_hang_hoa_phan_loai ON hang_hoa(phan_loai_id);
CREATE INDEX idx_hang_hoa_trang_thai ON hang_hoa(trang_thai);
CREATE INDEX idx_hang_hoa_is_deleted ON hang_hoa(is_deleted);
CREATE INDEX idx_inventory_lot_hang_hoa ON inventory_lot(hang_hoa_id);
CREATE INDEX idx_inventory_lot_kho ON inventory_lot(kho_id);
CREATE INDEX idx_inventory_lot_ngay_nhap ON inventory_lot(ngay_nhap);
CREATE INDEX idx_inventory_lot_ngay_het_han ON inventory_lot(ngay_het_han);
CREATE INDEX idx_inventory_lot_trang_thai ON inventory_lot(trang_thai);
CREATE INDEX idx_phieu_nhap_kho ON phieu_nhap(kho_id);
CREATE INDEX idx_phieu_nhap_ngay ON phieu_nhap(ngay_nhap);
CREATE INDEX idx_phieu_xuat_kho ON phieu_xuat(kho_id);
CREATE INDEX idx_phieu_xuat_ngay ON phieu_xuat(ngay_xuat);
CREATE INDEX idx_bin_location_kho ON bin_location(kho_id);
CREATE INDEX idx_chuyen_kho_kho_xuat ON chuyen_kho(kho_xuat_id);
CREATE INDEX idx_chuyen_kho_kho_nhan ON chuyen_kho(kho_nhan_id);
CREATE INDEX idx_huy_hang_kho ON huy_hang(kho_id);
CREATE INDEX idx_nha_cung_cap_trang_thai ON nha_cung_cap(trang_thai);

-- 4. RLS
-- ------------------------------------------------------------

ALTER TABLE don_vi_tinh ENABLE ROW LEVEL SECURITY;
ALTER TABLE phan_loai_hh ENABLE ROW LEVEL SECURITY;
ALTER TABLE kho_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE bin_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE hang_hoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lot ENABLE ROW LEVEL SECURITY;
ALTER TABLE phieu_nhap ENABLE ROW LEVEL SECURITY;
ALTER TABLE phieu_nhap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE phieu_xuat ENABLE ROW LEVEL SECURITY;
ALTER TABLE phieu_xuat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chuyen_kho ENABLE ROW LEVEL SECURITY;
ALTER TABLE chuyen_kho_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiem_ke ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiem_ke_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE huy_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE nha_cung_cap ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access don_vi_tinh" ON don_vi_tinh FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phan_loai_hh" ON phan_loai_hh FOR ALL USING (is_admin());
CREATE POLICY "Admin full access kho_hang" ON kho_hang FOR ALL USING (is_admin());
CREATE POLICY "Admin full access bin_location" ON bin_location FOR ALL USING (is_admin());
CREATE POLICY "Admin full access hang_hoa" ON hang_hoa FOR ALL USING (is_admin());
CREATE POLICY "Admin full access inventory_lot" ON inventory_lot FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phieu_nhap" ON phieu_nhap FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phieu_nhap_items" ON phieu_nhap_items FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phieu_xuat" ON phieu_xuat FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phieu_xuat_items" ON phieu_xuat_items FOR ALL USING (is_admin());
CREATE POLICY "Admin full access chuyen_kho" ON chuyen_kho FOR ALL USING (is_admin());
CREATE POLICY "Admin full access chuyen_kho_items" ON chuyen_kho_items FOR ALL USING (is_admin());
CREATE POLICY "Admin full access kiem_ke" ON kiem_ke FOR ALL USING (is_admin());
CREATE POLICY "Admin full access kiem_ke_items" ON kiem_ke_items FOR ALL USING (is_admin());
CREATE POLICY "Admin full access huy_hang" ON huy_hang FOR ALL USING (is_admin());
CREATE POLICY "Admin full access nha_cung_cap" ON nha_cung_cap FOR ALL USING (is_admin());

-- Authenticated users can read reference data
CREATE POLICY "Auth read don_vi_tinh" ON don_vi_tinh FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phan_loai_hh" ON phan_loai_hh FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read kho_hang" ON kho_hang FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read bin_location" ON bin_location FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read hang_hoa" ON hang_hoa FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read inventory_lot" ON inventory_lot FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phieu_nhap" ON phieu_nhap FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phieu_nhap_items" ON phieu_nhap_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phieu_xuat" ON phieu_xuat FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phieu_xuat_items" ON phieu_xuat_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read chuyen_kho" ON chuyen_kho FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read chuyen_kho_items" ON chuyen_kho_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read kiem_ke" ON kiem_ke FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read kiem_ke_items" ON kiem_ke_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read huy_hang" ON huy_hang FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read nha_cung_cap" ON nha_cung_cap FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. TRIGGERS: auto-update updated_at
-- ------------------------------------------------------------

CREATE TRIGGER set_kho_hang_updated_at BEFORE UPDATE ON kho_hang
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_hang_hoa_updated_at BEFORE UPDATE ON hang_hoa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_phieu_nhap_updated_at BEFORE UPDATE ON phieu_nhap
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_phieu_xuat_updated_at BEFORE UPDATE ON phieu_xuat
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_chuyen_kho_updated_at BEFORE UPDATE ON chuyen_kho
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_kiem_ke_updated_at BEFORE UPDATE ON kiem_ke
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_huy_hang_updated_at BEFORE UPDATE ON huy_hang
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_nha_cung_cap_updated_at BEFORE UPDATE ON nha_cung_cap
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
