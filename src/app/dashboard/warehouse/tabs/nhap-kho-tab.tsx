"use client";

import { useEffect, useState, useCallback } from "react";
import type { PhieuNhap, KhoHang, HangHoa } from "@/types/wms";

const LABEL_LOAI_NHAP: Record<string, string> = {
  tu_ncc: "Từ NCC",
  chuyen_kho_den: "Chuyển kho đến",
  kiem_ke_thua: "Kiểm kê thừa",
  khac: "Khác",
};

const LABEL_TRANG_THAI: Record<string, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_xac_nhan: "Đã nhập",
  huy: "Hủy",
};

const COLOR_TRANG_THAI: Record<string, string> = {
  nhap: "bg-gray-100 text-gray-600",
  cho_duyet: "bg-yellow-100 text-yellow-700",
  da_xac_nhan: "bg-green-100 text-green-700",
  huy: "bg-red-100 text-red-600",
};

interface NhapKhoItem {
  hang_hoa_id: string;
  ten_hh: string;
  so_luong: number;
  don_gia: number;
  lot_number: string;
  ngay_het_han: string;
}

export default function NhapKhoTab() {
  const [phieuList, setPhieuList] = useState<PhieuNhap[]>([]);
  const [khoList, setKhoList] = useState<KhoHang[]>([]);
  const [hangHoaList, setHangHoaList] = useState<HangHoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formKho, setFormKho] = useState("");
  const [formLoai, setFormLoai] = useState("tu_ncc");
  const [formNguon, setFormNguon] = useState("");
  const [formGhiChu, setFormGhiChu] = useState("");
  const [formItems, setFormItems] = useState<NhapKhoItem[]>([
    { hang_hoa_id: "", ten_hh: "", so_luong: 0, don_gia: 0, lot_number: "", ngay_het_han: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchPhieu = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wms/phieu-nhap");
    const data = await res.json();
    setPhieuList(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPhieu();
    fetch("/api/wms/kho").then((r) => r.json()).then((d) => Array.isArray(d) && setKhoList(d));
    fetch("/api/wms/hang-hoa").then((r) => r.json()).then((d) => {
      const items = d?.data || d;
      if (Array.isArray(items)) setHangHoaList(items);
    });
  }, [fetchPhieu]);

  function addItem() {
    setFormItems([...formItems, { hang_hoa_id: "", ten_hh: "", so_luong: 0, don_gia: 0, lot_number: "", ngay_het_han: "" }]);
  }

  function removeItem(idx: number) {
    setFormItems(formItems.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: string | number) {
    const updated = [...formItems];
    (updated[idx] as Record<string, string | number>)[field] = value;
    setFormItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const validItems = formItems.filter((item) => item.hang_hoa_id && item.so_luong > 0);
    if (validItems.length === 0) {
      setError("Cần ít nhất 1 dòng hàng hóa");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/wms/phieu-nhap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kho_id: formKho,
        loai_nhap: formLoai,
        nguon: formNguon,
        ghi_chu: formGhiChu,
        items: validItems.map((item) => ({
          hang_hoa_id: item.hang_hoa_id,
          so_luong: item.so_luong,
          don_gia: item.don_gia,
          lot_number: item.lot_number || undefined,
          ngay_het_han: item.ngay_het_han || undefined,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Lỗi tạo phiếu nhập");
      setSubmitting(false);
      return;
    }

    setShowForm(false);
    setFormItems([{ hang_hoa_id: "", ten_hh: "", so_luong: 0, don_gia: 0, lot_number: "", ngay_het_han: "" }]);
    setFormKho("");
    setFormNguon("");
    setFormGhiChu("");
    setSubmitting(false);
    fetchPhieu();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{phieuList.length} phiếu nhập</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Tạo phiếu nhập
        </button>
      </div>

      {/* Form tạo phiếu nhập */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <h3 className="mb-4 font-medium">Phiếu nhập kho mới</h3>

          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Kho nhập *</label>
              <select required value={formKho} onChange={(e) => setFormKho(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="">— Chọn kho —</option>
                {khoList.map((k) => <option key={k.id} value={k.id}>{k.ten_kho}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Loại nhập</label>
              <select value={formLoai} onChange={(e) => setFormLoai(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                {Object.entries(LABEL_LOAI_NHAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nguồn hàng</label>
              <input type="text" value={formNguon} onChange={(e) => setFormNguon(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Tên NCC, mã kho..." />
            </div>
          </div>

          {/* Items table */}
          <table className="mb-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1">Hàng hóa *</th>
                <th className="pb-1 w-24">SL *</th>
                <th className="pb-1 w-28">Đơn giá</th>
                <th className="pb-1 w-28">Mã lô</th>
                <th className="pb-1 w-32">HSD</th>
                <th className="pb-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {formItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1 pr-2">
                    <select value={item.hang_hoa_id} onChange={(e) => updateItem(idx, "hang_hoa_id", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900">
                      <option value="">— Chọn —</option>
                      {hangHoaList.map((hh) => <option key={hh.id} value={hh.id}>{hh.ma_hang_hoa} — {hh.ten}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="0.001" value={item.so_luong || ""} onChange={(e) => updateItem(idx, "so_luong", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" value={item.don_gia || ""} onChange={(e) => updateItem(idx, "don_gia", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="text" value={item.lot_number} onChange={(e) => updateItem(idx, "lot_number", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="Auto" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="date" value={item.ngay_het_han} onChange={(e) => updateItem(idx, "ngay_het_han", e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" />
                  </td>
                  <td className="py-1">
                    {formItems.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">x</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={addItem} className="mb-4 text-sm text-blue-600 hover:underline">
            + Thêm dòng
          </button>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium">Ghi chú</label>
            <textarea value={formGhiChu} onChange={(e) => setFormGhiChu(e.target.value)} rows={2}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Đang lưu..." : "Xác nhận nhập kho"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700">
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Danh sách phiếu nhập */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Mã phiếu</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Ngày nhập</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Kho</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Loại</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Nguồn</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
            ) : phieuList.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chưa có phiếu nhập nào</td></tr>
            ) : (
              phieuList.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-2 font-mono text-xs">{p.ma_phieu}</td>
                  <td className="px-4 py-2">{new Date(p.ngay_nhap).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-2">{p.kho?.ten_kho || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{LABEL_LOAI_NHAP[p.loai_nhap] || p.loai_nhap}</td>
                  <td className="px-4 py-2 text-gray-500">{p.nguon || "—"}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_TRANG_THAI[p.trang_thai] || ""}`}>
                      {LABEL_TRANG_THAI[p.trang_thai] || p.trang_thai}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
