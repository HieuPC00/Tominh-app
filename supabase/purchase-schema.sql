-- =============================================
-- PURCHASE MANAGEMENT SCHEMA
-- Module Thu Mua — Quản lý đặt hàng & công nợ NCC
-- =============================================

-- 1. Bảng phiếu đặt hàng (Purchase Orders)
CREATE TABLE IF NOT EXISTS phieu_dat_hang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phieu VARCHAR(30) NOT NULL UNIQUE,
  ncc_id UUID NOT NULL REFERENCES nha_cung_cap(id),
  ngay_dat DATE NOT NULL DEFAULT CURRENT_DATE,
  ngay_giao DATE,
  trang_thai VARCHAR(20) NOT NULL DEFAULT 'cho_xac_nhan',
  ghi_chu TEXT,
  so_hoa_don VARCHAR(50),
  tong_tien_hoa_don DECIMAL(15,2),
  subtotal DECIMAL(15,2) DEFAULT 0,
  vat_amt DECIMAL(15,2) DEFAULT 0,
  tong_tien DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_trang_thai_dat_hang CHECK (
    trang_thai IN ('cho_xac_nhan', 'da_xac_nhan', 'dang_giao', 'da_nhan_hang', 'da_thanh_toan', 'huy')
  )
);

-- 2. Bảng chi tiết phiếu đặt hàng (PO Line Items)
CREATE TABLE IF NOT EXISTS phieu_dat_hang_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phieu_dat_hang_id UUID NOT NULL REFERENCES phieu_dat_hang(id) ON DELETE CASCADE,
  hang_hoa_id UUID REFERENCES hang_hoa(id),
  ten_hang_hoa VARCHAR(255) NOT NULL,
  don_vi_tinh VARCHAR(30),
  so_luong DECIMAL(15,3) NOT NULL,
  don_gia DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_pct DECIMAL(5,2) DEFAULT 0,
  ghi_chu TEXT
);

-- 3. Bảng thanh toán NCC (Supplier Payments)
CREATE TABLE IF NOT EXISTS thanh_toan_ncc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncc_id UUID NOT NULL REFERENCES nha_cung_cap(id),
  phieu_dat_hang_id UUID REFERENCES phieu_dat_hang(id),
  so_tien DECIMAL(15,2) NOT NULL,
  ngay_thanh_toan DATE NOT NULL DEFAULT CURRENT_DATE,
  phuong_thuc VARCHAR(20) NOT NULL DEFAULT 'chuyen_khoan',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_phuong_thuc CHECK (
    phuong_thuc IN ('chuyen_khoan', 'tien_mat', 'sec', 'vi_dien_tu', 'khac')
  ),
  CONSTRAINT chk_so_tien_positive CHECK (so_tien > 0)
);

-- 4. ALTER bảng phieu_nhap — thêm liên kết PO
ALTER TABLE phieu_nhap ADD COLUMN IF NOT EXISTS phieu_dat_hang_id UUID REFERENCES phieu_dat_hang(id);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_phieu_dat_hang_ncc ON phieu_dat_hang(ncc_id);
CREATE INDEX IF NOT EXISTS idx_phieu_dat_hang_trang_thai ON phieu_dat_hang(trang_thai);
CREATE INDEX IF NOT EXISTS idx_phieu_dat_hang_ngay_dat ON phieu_dat_hang(ngay_dat);
CREATE INDEX IF NOT EXISTS idx_pdh_items_phieu ON phieu_dat_hang_items(phieu_dat_hang_id);
CREATE INDEX IF NOT EXISTS idx_pdh_items_hang_hoa ON phieu_dat_hang_items(hang_hoa_id);
CREATE INDEX IF NOT EXISTS idx_thanh_toan_ncc_ncc ON thanh_toan_ncc(ncc_id);
CREATE INDEX IF NOT EXISTS idx_thanh_toan_ncc_phieu ON thanh_toan_ncc(phieu_dat_hang_id);
CREATE INDEX IF NOT EXISTS idx_thanh_toan_ncc_ngay ON thanh_toan_ncc(ngay_thanh_toan);
CREATE INDEX IF NOT EXISTS idx_phieu_nhap_pdh ON phieu_nhap(phieu_dat_hang_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE phieu_dat_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE phieu_dat_hang_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE thanh_toan_ncc ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access phieu_dat_hang" ON phieu_dat_hang FOR ALL USING (is_admin());
CREATE POLICY "Admin full access phieu_dat_hang_items" ON phieu_dat_hang_items FOR ALL USING (is_admin());
CREATE POLICY "Admin full access thanh_toan_ncc" ON thanh_toan_ncc FOR ALL USING (is_admin());

-- Authenticated read access
CREATE POLICY "Auth read phieu_dat_hang" ON phieu_dat_hang FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read phieu_dat_hang_items" ON phieu_dat_hang_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read thanh_toan_ncc" ON thanh_toan_ncc FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================
-- TRIGGER: auto-update updated_at
-- =============================================
CREATE TRIGGER set_phieu_dat_hang_updated_at
  BEFORE UPDATE ON phieu_dat_hang
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
