"use client";

import { useState, useMemo } from "react";
import type {
  PhieuDatHang,
  PhieuDatHangItem,
  TrangThaiDatHang,
} from "@/types/wms";
import ProductAutocomplete from "./product-autocomplete";

const TRANG_THAI_DISPLAY: Record<string, string> = {
  cho_xac_nhan: "Chờ xác nhận",
  da_xac_nhan: "Đã xác nhận",
  dang_giao: "Đang giao",
  da_nhan_hang: "Đã nhận hàng",
  da_thanh_toan: "Đã thanh toán",
  huy: "Hủy",
};

const STATUS_COLORS: Record<string, string> = {
  cho_xac_nhan:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  da_xac_nhan:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  dang_giao:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  da_nhan_hang:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  da_thanh_toan:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  huy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface PODetailModalProps {
  order: PhieuDatHang;
  onClose: () => void;
  onSave: (updated: PhieuDatHang) => void;
}

function emptyItem(): PhieuDatHangItem {
  return {
    id: crypto.randomUUID(),
    phieu_dat_hang_id: "",
    hang_hoa_id: null,
    ten_hang_hoa: "",
    don_vi_tinh: null,
    so_luong: 0,
    don_gia: 0,
    vat_pct: 0,
    ghi_chu: null,
  };
}

export default function PODetailModal({
  order,
  onClose,
  onSave,
}: PODetailModalProps) {
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [trangThai, setTrangThai] = useState<TrangThaiDatHang>(
    order.trang_thai
  );
  const [ngayDat, setNgayDat] = useState(order.ngay_dat);
  const [ngayGiao, setNgayGiao] = useState(order.ngay_giao || "");
  const [ghiChu, setGhiChu] = useState(order.ghi_chu || "");
  const [soHoaDon, setSoHoaDon] = useState(order.so_hoa_don || "");
  const [tongTienHoaDon, setTongTienHoaDon] = useState<number>(
    order.tong_tien_hoa_don || 0
  );
  const [items, setItems] = useState<PhieuDatHangItem[]>(
    order.items ? [...order.items] : []
  );

  // Product search state per row (for adding new items)
  const [productSearches, setProductSearches] = useState<
    Record<string, string>
  >({});

  // Computed totals
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.so_luong * item.don_gia,
      0
    );
    const vatAmt = items.reduce(
      (sum, item) =>
        sum + item.so_luong * item.don_gia * (item.vat_pct / 100),
      0
    );
    const tongTien = subtotal + vatAmt;
    return { subtotal, vatAmt, tongTien };
  }, [items]);

  const chenhLech = tongTienHoaDon
    ? tongTienHoaDon - totals.tongTien
    : 0;

  function formatMoney(n: number): string {
    return n.toLocaleString("vi-VN");
  }

  function thanhTien(item: PhieuDatHangItem): number {
    return item.so_luong * item.don_gia * (1 + item.vat_pct / 100);
  }

  function updateItem(
    index: number,
    field: keyof PhieuDatHangItem,
    value: string | number | null
  ) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function handleSave() {
    const updated: PhieuDatHang = {
      ...order,
      trang_thai: trangThai,
      ngay_dat: ngayDat,
      ngay_giao: ngayGiao || null,
      ghi_chu: ghiChu || null,
      so_hoa_don: soHoaDon || null,
      tong_tien_hoa_don: tongTienHoaDon || null,
      subtotal: totals.subtotal,
      vat_amt: totals.vatAmt,
      tong_tien: totals.tongTien,
      items,
    };
    onSave(updated);
  }

  function handleCancel() {
    // Reset all fields to original order
    setTrangThai(order.trang_thai);
    setNgayDat(order.ngay_dat);
    setNgayGiao(order.ngay_giao || "");
    setGhiChu(order.ghi_chu || "");
    setSoHoaDon(order.so_hoa_don || "");
    setTongTienHoaDon(order.tong_tien_hoa_don || 0);
    setItems(order.items ? [...order.items] : []);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-10">
      <div className="w-full max-w-5xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {order.ma_phieu}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[trangThai] || "bg-gray-100 text-gray-700"}`}
            >
              {TRANG_THAI_DISPLAY[trangThai] || trangThai}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                Chỉnh sửa
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Lưu thay đổi
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-2 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-auto px-6 py-4">
          {/* Info + Status section */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* NCC info */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Mã NCC
              </label>
              <p className="font-mono text-sm text-blue-600 dark:text-blue-400">
                {order.nha_cung_cap?.ma_ncc || "—"}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Tên NCC
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {order.nha_cung_cap?.ten_ncc || "—"}
              </p>
            </div>

            {/* Dates */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngày đặt
              </label>
              {editing ? (
                <input
                  type="date"
                  value={ngayDat}
                  onChange={(e) => setNgayDat(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              ) : (
                <p className="text-sm">
                  {ngayDat
                    ? new Date(ngayDat).toLocaleDateString("vi-VN")
                    : "—"}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngày giao dự kiến
              </label>
              {editing ? (
                <input
                  type="date"
                  value={ngayGiao}
                  onChange={(e) => setNgayGiao(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              ) : (
                <p className="text-sm">
                  {ngayGiao
                    ? new Date(ngayGiao).toLocaleDateString("vi-VN")
                    : "—"}
                </p>
              )}
            </div>

            {/* Status */}
            {editing && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Trạng thái
                </label>
                <select
                  value={trangThai}
                  onChange={(e) =>
                    setTrangThai(e.target.value as TrangThaiDatHang)
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {Object.entries(TRANG_THAI_DISPLAY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Invoice section */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Thông tin hoá đơn
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Số hoá đơn
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={soHoaDon}
                    onChange={(e) => setSoHoaDon(e.target.value)}
                    placeholder="VD: HD-2026-001"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                ) : (
                  <p className="text-sm">{soHoaDon || "—"}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Tổng tiền hoá đơn
                </label>
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    value={tongTienHoaDon || ""}
                    onChange={(e) =>
                      setTongTienHoaDon(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                ) : (
                  <p className="text-sm font-medium">
                    {tongTienHoaDon
                      ? formatMoney(tongTienHoaDon)
                      : "—"}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Chênh lệch
                </label>
                <p
                  className={`text-sm font-medium ${
                    chenhLech > 0
                      ? "text-red-600"
                      : chenhLech < 0
                        ? "text-orange-600"
                        : "text-green-600"
                  }`}
                >
                  {tongTienHoaDon
                    ? `${chenhLech >= 0 ? "+" : ""}${formatMoney(chenhLech)}`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Chi tiết hàng hóa
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  + Thêm dòng
                </button>
              )}
            </div>
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      STT
                    </th>
                    <th className="min-w-[200px] px-3 py-2 text-left font-medium text-gray-500">
                      Tên hàng
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      ĐVT
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      SL
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Đơn giá
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      VAT%
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Thành tiền
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Ghi chú
                    </th>
                    {editing && (
                      <th className="px-3 py-2 text-center font-medium text-gray-500">
                        Xóa
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={editing ? 9 : 8}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        Chưa có hàng hóa
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-3 py-2 text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <ProductAutocomplete
                              value={
                                productSearches[item.id] ??
                                item.ten_hang_hoa
                              }
                              onChange={(v) =>
                                setProductSearches((prev) => ({
                                  ...prev,
                                  [item.id]: v,
                                }))
                              }
                              onSelect={(product) => {
                                updateItem(
                                  idx,
                                  "hang_hoa_id",
                                  product.id
                                );
                                updateItem(
                                  idx,
                                  "ten_hang_hoa",
                                  product.ten
                                );
                                updateItem(
                                  idx,
                                  "don_vi_tinh",
                                  product.don_vi_tinh?.ten_dvt || null
                                );
                                if (
                                  product.gia_binh_quan > 0 &&
                                  item.don_gia === 0
                                ) {
                                  updateItem(
                                    idx,
                                    "don_gia",
                                    product.gia_binh_quan
                                  );
                                }
                                setProductSearches((prev) => ({
                                  ...prev,
                                  [item.id]: product.ten,
                                }));
                              }}
                              placeholder="Tìm hàng hóa..."
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">
                              {item.ten_hang_hoa}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {editing ? (
                            <input
                              type="text"
                              value={item.don_vi_tinh || ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "don_vi_tinh",
                                  e.target.value || null
                                )
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                            />
                          ) : (
                            item.don_vi_tinh || "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              value={item.so_luong || ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "so_luong",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                            />
                          ) : (
                            formatMoney(item.so_luong)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              value={item.don_gia || ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "don_gia",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                            />
                          ) : (
                            formatMoney(item.don_gia)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.vat_pct || ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "vat_pct",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                            />
                          ) : (
                            `${item.vat_pct}%`
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(thanhTien(item))}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="text"
                              value={item.ghi_chu || ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "ghi_chu",
                                  e.target.value || null
                                )
                              }
                              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                              placeholder="Ghi chú"
                            />
                          ) : (
                            <span className="text-xs text-gray-500">
                              {item.ghi_chu || "—"}
                            </span>
                          )}
                        </td>
                        {editing && (
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary footer */}
          <div className="mb-6 flex justify-end">
            <div className="w-72 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tổng cộng:</span>
                <span>{formatMoney(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT:</span>
                <span>{formatMoney(totals.vatAmt)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold dark:border-gray-700">
                <span>Tổng thanh toán:</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {formatMoney(totals.tongTien)}
                </span>
              </div>
            </div>
          </div>

          {/* Ghi chu */}
          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Ghi chú
            </label>
            {editing ? (
              <textarea
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Ghi chú phiếu đặt hàng..."
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {ghiChu || "—"}
              </p>
            )}
          </div>

          {/* Signature section */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Ký duyệt
            </h3>
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <div className="space-y-8">
                <p className="text-xs font-medium text-gray-500">
                  Người lập
                </p>
                <div className="h-16 border-b border-dashed border-gray-300 dark:border-gray-700" />
                <p className="text-xs text-gray-400">
                  (Ký, ghi rõ họ tên)
                </p>
              </div>
              <div className="space-y-8">
                <p className="text-xs font-medium text-gray-500">
                  Trưởng phòng MH
                </p>
                <div className="h-16 border-b border-dashed border-gray-300 dark:border-gray-700" />
                <p className="text-xs text-gray-400">
                  (Ký, ghi rõ họ tên)
                </p>
              </div>
              <div className="space-y-8">
                <p className="text-xs font-medium text-gray-500">
                  Giám đốc
                </p>
                <div className="h-16 border-b border-dashed border-gray-300 dark:border-gray-700" />
                <p className="text-xs text-gray-400">
                  (Ký, ghi rõ họ tên)
                </p>
              </div>
              <div className="space-y-8">
                <p className="text-xs font-medium text-gray-500">
                  NCC xác nhận
                </p>
                <div className="h-16 border-b border-dashed border-gray-300 dark:border-gray-700" />
                <p className="text-xs text-gray-400">
                  (Ký, đóng dấu)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
