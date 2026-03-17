"use client";

import { useEffect, useState, useCallback } from "react";
import type { PhieuXuat, KhoHang, HangHoa } from "@/types/wms";

const LABEL_LOAI_XUAT: Record<string, string> = {
  su_dung: "Sử dụng",
  chuyen_kho_di: "Chuyển kho đi",
  tra_ncc: "Trả NCC",
  huy_hang: "Hủy hàng",
  kiem_ke_thieu: "Kiểm kê thiếu",
  khac: "Khác",
};

const LABEL_TRANG_THAI: Record<string, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_xac_nhan: "Đã xuất",
  huy: "Hủy",
};

const COLOR_TRANG_THAI: Record<string, string> = {
  nhap: "bg-gray-100 text-gray-600",
  cho_duyet: "bg-yellow-100 text-yellow-700",
  da_xac_nhan: "bg-green-100 text-green-700",
  huy: "bg-red-100 text-red-600",
};

interface XuatKhoItem {
  hang_hoa_id: string;
  so_luong: number;
}

export default function XuatKhoTab() {
  const [phieuList, setPhieuList] = useState<PhieuXuat[]>([]);
  const [khoList, setKhoList] = useState<KhoHang[]>([]);
  const [hangHoaList, setHangHoaList] = useState<HangHoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formKho, setFormKho] = useState("");
  const [formLoai, setFormLoai] = useState("su_dung");
  const [formNoiNhan, setFormNoiNhan] = useState("");
  const [formGhiChu, setFormGhiChu] = useState("");
  const [formItems, setFormItems] = useState<XuatKhoItem[]>([{ hang_hoa_id: "", so_luong: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchPhieu = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wms/phieu-xuat");
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
    setFormItems([...formItems, { hang_hoa_id: "", so_luong: 0 }]);
  }

  function removeItem(idx: number) {
    setFormItems(formItems.filter((_, i) => i !== idx));
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

    const res = await fetch("/api/wms/phieu-xuat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kho_id: formKho,
        loai_xuat: formLoai,
        noi_nhan: formNoiNhan,
        ghi_chu: formGhiChu,
        items: validItems,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Lỗi tạo phiếu xuất");
      setSubmitting(false);
      return;
    }

    setShowForm(false);
    setFormItems([{ hang_hoa_id: "", so_luong: 0 }]);
    setSubmitting(false);
    fetchPhieu();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{phieuList.length} phiếu xuất</p>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
          + Tạo phiếu xuất
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
          <h3 className="mb-4 font-medium">Phiếu xuất kho mới</h3>
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Kho xuất *</label>
              <select required value={formKho} onChange={(e) => setFormKho(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="">— Chọn kho —</option>
                {khoList.map((k) => <option key={k.id} value={k.id}>{k.ten_kho}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Loại xuất</label>
              <select value={formLoai} onChange={(e) => setFormLoai(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                {Object.entries(LABEL_LOAI_XUAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nơi nhận</label>
              <input type="text" value={formNoiNhan} onChange={(e) => setFormNoiNhan(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Cửa hàng, bộ phận..." />
            </div>
          </div>

          <table className="mb-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1">Hàng hóa *</th>
                <th className="pb-1 w-28">SL xuất *</th>
                <th className="pb-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {formItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1 pr-2">
                    <select value={item.hang_hoa_id} onChange={(e) => {
                      const updated = [...formItems];
                      updated[idx].hang_hoa_id = e.target.value;
                      setFormItems(updated);
                    }}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900">
                      <option value="">— Chọn —</option>
                      {hangHoaList.map((hh) => <option key={hh.id} value={hh.id}>{hh.ma_hang_hoa} — {hh.ten}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="0.001" value={item.so_luong || ""} onChange={(e) => {
                      const updated = [...formItems];
                      updated[idx].so_luong = parseFloat(e.target.value) || 0;
                      setFormItems(updated);
                    }}
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

          <button type="button" onClick={addItem} className="mb-4 text-sm text-orange-600 hover:underline">+ Thêm dòng</button>

          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? "Đang lưu..." : "Xác nhận xuất kho"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700">Hủy</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Mã phiếu</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Ngày xuất</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Kho</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Loại</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Nơi nhận</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
            ) : phieuList.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chưa có phiếu xuất nào</td></tr>
            ) : (
              phieuList.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-2 font-mono text-xs">{p.ma_phieu}</td>
                  <td className="px-4 py-2">{new Date(p.ngay_xuat).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-2">{p.kho?.ten_kho || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{LABEL_LOAI_XUAT[p.loai_xuat] || p.loai_xuat}</td>
                  <td className="px-4 py-2 text-gray-500">{p.noi_nhan || "—"}</td>
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
