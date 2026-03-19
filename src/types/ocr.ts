export interface OcrSupplierResult {
  matched_id: string | null;
  matched_ma_ncc: string | null;
  matched_ten_ncc: string | null;
  ocr_ten_ncc: string;
  ma_so_thue: string | null;
}

export interface OcrInvoiceItem {
  matched_hang_hoa_id: string | null;
  matched_ten: string | null;
  matched_dvt: string | null;
  matched_gia: number | null;
  ocr_ten_hang_hoa: string;
  don_vi_tinh: string;
  so_luong: number;
  don_gia: number;
  vat_pct: number;
}

export interface OcrInvoiceResult {
  supplier: OcrSupplierResult;
  items: OcrInvoiceItem[];
  invoice_info: {
    so_hoa_don: string | null;
    ngay_hoa_don: string | null;
  };
}
