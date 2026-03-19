"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { PhieuDatHang, ThanhToanNCC } from "@/types/wms";
import PODetailModal from "../components/po-detail-modal";

const TRANG_THAI_LABELS: Record<string, string> = {
  cho_xac_nhan: "Cho xac nhan",
  da_xac_nhan: "Da xac nhan",
  dang_giao: "Dang giao",
  da_nhan_hang: "Da nhan hang",
  da_thanh_toan: "Da thanh toan",
  huy: "Huy",
};

const STATUS_COLORS: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  cho_xac_nhan: {
    text: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-300",
  },
  da_xac_nhan: {
    text: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-300",
  },
  dang_giao: {
    text: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-300",
  },
  da_nhan_hang: {
    text: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-300",
  },
  da_thanh_toan: {
    text: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-300",
  },
  huy: {
    text: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-300",
  },
};

interface NccSummary {
  ncc_id: string;
  ma_ncc: string;
  ten_ncc: string;
  soDon: number;
  tongTien: number;
  daTT: number;
  chuaTT: number;
  pctNo: number;
  orders: PhieuDatHang[];
}

export default function TongHopTab() {
  const [allOrders, setAllOrders] = useState<PhieuDatHang[]>([]);
  const [allPayments, setAllPayments] = useState<ThanhToanNCC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // NCC orders modal
  const [selectedNcc, setSelectedNcc] = useState<NccSummary | null>(null);

  // PO detail modal
  const [selectedOrder, setSelectedOrder] = useState<PhieuDatHang | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch all POs (non-cancelled) and all payments in parallel
      const [ordersRes, paymentsRes] = await Promise.all([
        fetch("/api/wms/phieu-dat-hang?limit=9999&page=1"),
        fetch("/api/wms/thanh-toan-ncc?limit=9999"),
      ]);

      if (!ordersRes.ok) throw new Error("Loi tai danh sach don hang");

      const ordersData = await ordersRes.json();
      const allPOs: PhieuDatHang[] = ordersData?.data || [];
      // Filter out cancelled orders
      const activePOs = allPOs.filter((po) => po.trang_thai !== "huy");
      setAllOrders(activePOs);

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setAllPayments(paymentsData?.data || paymentsData || []);
      } else {
        setAllPayments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loi tai du lieu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function formatMoney(n: number): string {
    return n.toLocaleString("vi-VN");
  }

  // Compute NCC summaries
  const nccSummaries = useMemo(() => {
    // Group orders by ncc_id
    const ordersByNcc: Record<string, PhieuDatHang[]> = {};
    for (const order of allOrders) {
      const nccId = order.ncc_id;
      if (!ordersByNcc[nccId]) ordersByNcc[nccId] = [];
      ordersByNcc[nccId].push(order);
    }

    // Group payments by ncc_id
    const paymentsByNcc: Record<string, number> = {};
    for (const payment of allPayments) {
      const nccId = payment.ncc_id;
      paymentsByNcc[nccId] = (paymentsByNcc[nccId] || 0) + payment.so_tien;
    }

    // Build summaries
    const summaries: NccSummary[] = [];
    for (const [nccId, orders] of Object.entries(ordersByNcc)) {
      const tongTien = orders.reduce(
        (sum, o) => sum + (o.tong_tien || 0),
        0
      );
      const daTT = paymentsByNcc[nccId] || 0;
      const chuaTT = Math.max(0, tongTien - daTT);
      const pctNo = tongTien > 0 ? (chuaTT / tongTien) * 100 : 0;

      const firstOrder = orders[0];
      summaries.push({
        ncc_id: nccId,
        ma_ncc: firstOrder.nha_cung_cap?.ma_ncc || "--",
        ten_ncc: firstOrder.nha_cung_cap?.ten_ncc || "--",
        soDon: orders.length,
        tongTien,
        daTT,
        chuaTT,
        pctNo,
        orders,
      });
    }

    return summaries.sort((a, b) => b.chuaTT - a.chuaTT);
  }, [allOrders, allPayments]);

  // Filter by search
  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return nccSummaries;
    const q = search.toLowerCase();
    return nccSummaries.filter(
      (s) =>
        s.ma_ncc.toLowerCase().includes(q) ||
        s.ten_ncc.toLowerCase().includes(q)
    );
  }, [nccSummaries, search]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, s) => ({
        tongTien: acc.tongTien + s.tongTien,
        daTT: acc.daTT + s.daTT,
        chuaTT: acc.chuaTT + s.chuaTT,
      }),
      { tongTien: 0, daTT: 0, chuaTT: 0 }
    );
  }, [filteredSummaries]);

  async function handleViewPODetail(orderId: string) {
    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${orderId}`);
      if (!res.ok) throw new Error("Loi tai chi tiet");
      const data = await res.json();
      if (data.phieu_dat_hang_items) {
        data.items = data.phieu_dat_hang_items;
      }
      setSelectedOrder(data);
    } catch {
      alert("Khong the tai chi tiet don hang");
    }
  }

  async function handleSaveDetail(updated: PhieuDatHang) {
    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trang_thai: updated.trang_thai,
          ngay_dat: updated.ngay_dat,
          ngay_giao: updated.ngay_giao,
          ghi_chu: updated.ghi_chu,
          so_hoa_don: updated.so_hoa_don,
          tong_tien_hoa_don: updated.tong_tien_hoa_don,
          items: updated.items?.map((item) => ({
            hang_hoa_id: item.hang_hoa_id || null,
            ten_hang_hoa: item.ten_hang_hoa,
            don_vi_tinh: item.don_vi_tinh || null,
            so_luong: item.so_luong,
            don_gia: item.don_gia,
            vat_pct: item.vat_pct || 0,
            ghi_chu: item.ghi_chu || null,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Loi luu thay doi");
        return;
      }

      setSelectedOrder(null);
      fetchData();
    } catch {
      alert("Loi ket noi server");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bang Cong No Tong Hop NCC
          </h2>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
            <span>
              So NCC:{" "}
              <strong className="text-gray-900 dark:text-white">
                {filteredSummaries.length}
              </strong>
            </span>
            <span>
              Tong cong no:{" "}
              <strong className="text-red-600 dark:text-red-400">
                {formatMoney(grandTotals.chuaTT)}
              </strong>
            </span>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Lam moi
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tim theo ma NCC, ten cong ty..."
          className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950">
          {error}
        </div>
      )}

      {/* Summary table */}
      <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                #
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ma NCC
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ten cong ty
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                So don
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                Tong gia tri
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                Da thanh toan
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                Con no
              </th>
              <th className="min-w-[120px] px-3 py-2 text-center font-medium text-gray-500">
                % No
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                Xem don
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Dang tai...
                  </div>
                </td>
              </tr>
            ) : filteredSummaries.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {search
                    ? "Khong tim thay NCC phu hop"
                    : "Chua co du lieu cong no"}
                </td>
              </tr>
            ) : (
              <>
                {filteredSummaries.map((summary, idx) => {
                  const barWidth = Math.min(100, Math.max(0, summary.pctNo));
                  const barColor =
                    summary.pctNo > 80
                      ? "bg-red-500"
                      : summary.pctNo > 50
                        ? "bg-orange-500"
                        : summary.pctNo > 0
                          ? "bg-yellow-500"
                          : "bg-green-500";

                  return (
                    <tr
                      key={summary.ncc_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                          {summary.ma_ncc}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                        {summary.ten_ncc}
                      </td>
                      <td className="px-3 py-2 text-right">{summary.soDon}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatMoney(summary.tongTien)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                        {formatMoney(summary.daTT)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-600 dark:text-red-400">
                        {formatMoney(summary.chuaTT)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-gray-500">
                            {summary.pctNo.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setSelectedNcc(summary)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                        >
                          Xem don
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Footer totals */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900">
                  <td colSpan={3} className="px-3 py-2 text-right text-gray-500">
                    Tong cong:
                  </td>
                  <td className="px-3 py-2 text-right">
                    {filteredSummaries.reduce((s, r) => s + r.soDon, 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    {formatMoney(grandTotals.tongTien)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-green-600 dark:text-green-400">
                    {formatMoney(grandTotals.daTT)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400">
                    {formatMoney(grandTotals.chuaTT)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* NCC Orders Modal */}
      {selectedNcc && !selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-10">
          <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Don hang cua {selectedNcc.ten_ncc}
                </h2>
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    Ma NCC:{" "}
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {selectedNcc.ma_ncc}
                    </span>
                  </span>
                  <span>
                    So don:{" "}
                    <strong>{selectedNcc.soDon}</strong>
                  </span>
                  <span>
                    Con no:{" "}
                    <strong className="text-red-600 dark:text-red-400">
                      {formatMoney(selectedNcc.chuaTT)}
                    </strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNcc(null)}
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

            {/* Orders table */}
            <div className="max-h-[70vh] overflow-auto px-6 py-4">
              <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        So PO
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Ngay dat
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Tong tien
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Da TT
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Con no
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">
                        Trang thai
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {selectedNcc.orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-gray-400"
                        >
                          Khong co don hang
                        </td>
                      </tr>
                    ) : (
                      selectedNcc.orders.map((order) => {
                        // Find payments for this specific PO
                        const poPaid = allPayments
                          .filter(
                            (p) => p.phieu_dat_hang_id === order.id
                          )
                          .reduce((sum, p) => sum + p.so_tien, 0);
                        const poOwed = Math.max(
                          0,
                          (order.tong_tien || 0) - poPaid
                        );
                        const sc = STATUS_COLORS[order.trang_thai] || {
                          text: "text-gray-600",
                          bg: "bg-gray-50 dark:bg-gray-900",
                          border: "border-gray-300",
                        };

                        return (
                          <tr
                            key={order.id}
                            onClick={() => handleViewPODetail(order.id)}
                            className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                                {order.ma_phieu}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                              {order.ngay_dat
                                ? new Date(
                                    order.ngay_dat
                                  ).toLocaleDateString("vi-VN")
                                : "--"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatMoney(order.tong_tien)}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                              {formatMoney(poPaid)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-red-600 dark:text-red-400">
                              {formatMoney(poOwed)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.text} ${sc.bg} ${sc.border}`}
                              >
                                {TRANG_THAI_LABELS[order.trang_thai] ||
                                  order.trang_thai}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary footer */}
              <div className="mt-4 flex justify-end">
                <div className="w-72 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tong gia tri:</span>
                    <span className="font-medium">
                      {formatMoney(selectedNcc.tongTien)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Da thanh toan:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatMoney(selectedNcc.daTT)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold dark:border-gray-700">
                    <span>Con no:</span>
                    <span className="text-red-600 dark:text-red-400">
                      {formatMoney(selectedNcc.chuaTT)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedOrder && (
        <PODetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSave={handleSaveDetail}
        />
      )}
    </div>
  );
}
