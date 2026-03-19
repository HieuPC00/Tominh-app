"use client";

import { useState, useEffect, useMemo } from "react";
import type { PhieuDatHang, PhuongThucThanhToan } from "@/types/wms";
import SupplierAutocomplete from "./supplier-autocomplete";

const PHUONG_THUC_LABELS: Record<string, string> = {
  chuyen_khoan: "Chuyển khoản",
  tien_mat: "Tiền mặt",
  sec: "Séc",
  vi_dien_tu: "Ví điện tử",
  khac: "Khác",
};

interface PaymentRow {
  id: string;
  ncc_id: string;
  ma_ncc: string;
  ten_ncc: string;
  phieu_dat_hang_id?: string;
  ma_phieu?: string;
  so_tien: number;
  ghi_chu?: string;
}

interface PhieuChiPanelProps {
  onConfirm: (
    payments: Array<{
      ncc_id: string;
      phieu_dat_hang_id?: string;
      so_tien: number;
      ghi_chu?: string;
    }>,
    metadata: {
      soPhieu: string;
      ngay: string;
      phuongThuc: string;
      ghiChu: string;
    }
  ) => void;
  onClose: () => void;
}

function generateSoPhieu(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `PC-${y}${m}${d}-${seq}`;
}

export default function PhieuChiPanel({
  onConfirm,
  onClose,
}: PhieuChiPanelProps) {
  // Header fields
  const [soPhieu] = useState(generateSoPhieu);
  const [ngay, setNgay] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [phuongThuc, setPhuongThuc] =
    useState<PhuongThucThanhToan>("chuyen_khoan");
  const [ghiChuPhieu, setGhiChuPhieu] = useState("");

  // Add row state
  const [nccSearch, setNccSearch] = useState("");
  const [selectedNcc, setSelectedNcc] = useState<{
    id: string;
    ma_ncc: string;
    ten_ncc: string;
  } | null>(null);
  const [nccPOs, setNccPOs] = useState<
    Array<PhieuDatHang & { remaining: number }>
  >([]);
  const [selectedPO, setSelectedPO] = useState("");
  const [soTien, setSoTien] = useState("");
  const [ghiChuRow, setGhiChuRow] = useState("");
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Payment rows
  const [rows, setRows] = useState<PaymentRow[]>([]);

  // Fetch POs for selected NCC
  useEffect(() => {
    if (!selectedNcc) {
      setNccPOs([]);
      setSelectedPO("");
      return;
    }

    async function fetchPOs() {
      setLoadingPOs(true);
      try {
        const res = await fetch(
          `/api/wms/thu-mua/phieu-dat-hang?ncc_id=${selectedNcc!.id}&trang_thai=da_xac_nhan,dang_giao,da_nhan_hang`
        );
        if (!res.ok) {
          setNccPOs([]);
          setLoadingPOs(false);
          return;
        }
        const data = await res.json();
        const poList = data?.data || [];

        // Calculate remaining balance for each PO
        // (tong_tien minus already-paid amounts)
        const posWithBalance = poList.map((po: PhieuDatHang) => ({
          ...po,
          remaining: po.tong_tien, // Will be adjusted by API or caller
        }));

        setNccPOs(posWithBalance);
      } catch {
        setNccPOs([]);
      } finally {
        setLoadingPOs(false);
      }
    }

    fetchPOs();
  }, [selectedNcc]);

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + r.so_tien, 0),
    [rows]
  );

  function formatMoney(n: number): string {
    return n.toLocaleString("vi-VN");
  }

  function handleAddRow() {
    if (!selectedNcc) return;
    const amount = parseFloat(soTien);
    if (!amount || amount <= 0) return;

    const selectedPOData = nccPOs.find((po) => po.id === selectedPO);

    const newRow: PaymentRow = {
      id: crypto.randomUUID(),
      ncc_id: selectedNcc.id,
      ma_ncc: selectedNcc.ma_ncc,
      ten_ncc: selectedNcc.ten_ncc,
      phieu_dat_hang_id: selectedPO || undefined,
      ma_phieu: selectedPOData?.ma_phieu || undefined,
      so_tien: amount,
      ghi_chu: ghiChuRow || undefined,
    };

    setRows((prev) => [...prev, newRow]);

    // Reset add row fields
    setSoTien("");
    setGhiChuRow("");
    setSelectedPO("");
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleConfirm() {
    if (rows.length === 0) return;

    const payments = rows.map((r) => ({
      ncc_id: r.ncc_id,
      phieu_dat_hang_id: r.phieu_dat_hang_id,
      so_tien: r.so_tien,
      ghi_chu: r.ghi_chu,
    }));

    onConfirm(payments, {
      soPhieu,
      ngay,
      phuongThuc,
      ghiChu: ghiChuPhieu,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-10">
      <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lập Phiếu Chi
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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

        <div className="max-h-[80vh] overflow-auto px-6 py-4">
          {/* Metadata section */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Số phiếu
              </label>
              <input
                type="text"
                value={soPhieu}
                readOnly
                className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-mono dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngày thanh toán
              </label>
              <input
                type="date"
                value={ngay}
                onChange={(e) => setNgay(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Phương thức
              </label>
              <select
                value={phuongThuc}
                onChange={(e) =>
                  setPhuongThuc(e.target.value as PhuongThucThanhToan)
                }
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {Object.entries(PHUONG_THUC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ghi chú phiếu
              </label>
              <input
                type="text"
                value={ghiChuPhieu}
                onChange={(e) => setGhiChuPhieu(e.target.value)}
                placeholder="VD: Thanh toán đợt 1"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>

          {/* Add row section */}
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Thêm dòng thanh toán
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nhà cung cấp
                </label>
                <SupplierAutocomplete
                  value={nccSearch}
                  onChange={(v) => {
                    setNccSearch(v);
                    if (selectedNcc) setSelectedNcc(null);
                  }}
                  onSelect={(ncc) => {
                    setSelectedNcc(ncc);
                    setNccSearch(ncc.ten_ncc);
                  }}
                  selected={!!selectedNcc}
                  placeholder="Tìm NCC..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Phiếu đặt hàng
                </label>
                <select
                  value={selectedPO}
                  onChange={(e) => setSelectedPO(e.target.value)}
                  disabled={!selectedNcc || loadingPOs}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="">— Không chọn —</option>
                  {nccPOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.ma_phieu} ({formatMoney(po.tong_tien)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Số tiền
                </label>
                <input
                  type="number"
                  min="0"
                  value={soTien}
                  onChange={(e) => setSoTien(e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Ghi chú
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ghiChuRow}
                    onChange={(e) => setGhiChuRow(e.target.value)}
                    placeholder="Ghi chú..."
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={!selectedNcc || !soTien}
                    className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Added rows table */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Danh sách thanh toán ({rows.length} dòng)
            </h3>
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Mã NCC
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Tên công ty
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Số PO
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      Số tiền
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      Ghi chú
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">
                      Xóa
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        Chưa có dòng thanh toán nào
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-3 py-2 text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                            {row.ma_ncc}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                          {row.ten_ncc}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {row.ma_phieu || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(row.so_tien)}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 text-xs text-gray-500">
                          {row.ghi_chu || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer: Total + Confirm */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="text-sm">
              <span className="text-gray-500">Tổng thanh toán: </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatMoney(totalAmount)}
              </span>
              <span className="ml-1 text-xs text-gray-400">VND</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={rows.length === 0}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Xác nhận thanh toán
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
