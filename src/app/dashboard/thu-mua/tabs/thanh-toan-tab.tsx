"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type {
  ThanhToanNCC,
  PhieuDatHang,
  PhuongThucThanhToan,
} from "@/types/wms";
import SupplierAutocomplete from "../components/supplier-autocomplete";
import PhieuChiPanel from "../components/phieu-chi-panel";

const PHUONG_THUC_LABELS: Record<string, string> = {
  chuyen_khoan: "Chuyển khoản",
  tien_mat: "Tiền mặt",
  sec: "Sec",
  vi_dien_tu: "Vi dien tu",
  khac: "Khac",
};

function formatMoney(n: number): string {
  return n.toLocaleString("vi-VN");
}

interface Stats {
  total_debt: number;
  total_paid: number;
  outstanding: number;
  today_paid: number;
}

interface POWithRemaining extends PhieuDatHang {
  remaining: number;
  paid: number;
}

interface NCCSummary {
  ncc_id: string;
  ma_ncc: string;
  ten_ncc: string;
  tong_don_hang: number;
  da_thanh_toan: number;
  con_no: number;
  so_lan_tt: number;
  trang_thai: string;
}

export default function ThanhToanTab() {
  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Phieu Chi panel
  const [showPhieuChi, setShowPhieuChi] = useState(false);

  // Payment form
  const [nccSearch, setNccSearch] = useState("");
  const [selectedNcc, setSelectedNcc] = useState<{
    id: string;
    ma_ncc: string;
    ten_ncc: string;
  } | null>(null);
  const [nccPOs, setNccPOs] = useState<POWithRemaining[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [selectedPO, setSelectedPO] = useState("");
  const [soTien, setSoTien] = useState("");
  const [ngayTT, setNgayTT] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [phuongThuc, setPhuongThuc] =
    useState<PhuongThucThanhToan>("chuyen_khoan");
  const [ghiChu, setGhiChu] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // NCC summary
  const [nccSummaries, setNccSummaries] = useState<NCCSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  // Payment history
  const [payments, setPayments] = useState<ThanhToanNCC[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentFromDate, setPaymentFromDate] = useState("");
  const [paymentToDate, setPaymentToDate] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const paymentLimit = 20;
  const paymentTotalPages = Math.ceil(paymentTotal / paymentLimit);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/wms/thu-mua/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch POs for selected NCC (with remaining balance)
  useEffect(() => {
    if (!selectedNcc) {
      setNccPOs([]);
      setSelectedPO("");
      return;
    }

    async function fetchPOs() {
      setLoadingPOs(true);
      try {
        // Fetch POs
        const poRes = await fetch(
          `/api/wms/phieu-dat-hang?ncc_id=${selectedNcc!.id}&trang_thai=da_xac_nhan&limit=100`
        );
        const poData = await poRes.json();
        const poList: PhieuDatHang[] = poData?.data || [];

        // Fetch payments for this NCC
        const payRes = await fetch(
          `/api/wms/thanh-toan-ncc?ncc_id=${selectedNcc!.id}&limit=1000`
        );
        const payData = await payRes.json();
        const payList: ThanhToanNCC[] = payData?.data || [];

        // Calculate remaining for each PO
        const posWithBalance: POWithRemaining[] = poList.map((po) => {
          const paid = payList
            .filter((p) => p.phieu_dat_hang_id === po.id)
            .reduce((sum, p) => sum + (p.so_tien || 0), 0);
          return {
            ...po,
            paid,
            remaining: po.tong_tien - paid,
          };
        });

        // Filter to only show POs that still have remaining balance
        setNccPOs(posWithBalance.filter((po) => po.remaining > 0));
      } catch {
        setNccPOs([]);
      } finally {
        setLoadingPOs(false);
      }
    }

    fetchPOs();
  }, [selectedNcc]);

  // NCC summary info (for selected NCC)
  const nccSummaryInfo = useMemo(() => {
    if (!selectedNcc || nccPOs.length === 0) return null;
    const totalDebt = nccPOs.reduce((s, po) => s + po.tong_tien, 0);
    const totalPaid = nccPOs.reduce((s, po) => s + po.paid, 0);
    const remaining = totalDebt - totalPaid;
    const unpaidCount = nccPOs.filter((po) => po.remaining > 0).length;
    return { totalDebt, totalPaid, remaining, unpaidCount };
  }, [selectedNcc, nccPOs]);

  // Fetch NCC summaries (aggregate)
  const fetchNCCSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      // Get all POs (non-cancelled)
      const poRes = await fetch(
        "/api/wms/phieu-dat-hang?limit=1000"
      );
      const poData = await poRes.json();
      const poList: PhieuDatHang[] = (poData?.data || []).filter(
        (po: PhieuDatHang) => po.trang_thai !== "huy"
      );

      // Get all payments
      const payRes = await fetch("/api/wms/thanh-toan-ncc?limit=5000");
      const payData = await payRes.json();
      const payList: ThanhToanNCC[] = payData?.data || [];

      // Group by NCC
      const nccMap = new Map<
        string,
        {
          ncc_id: string;
          ma_ncc: string;
          ten_ncc: string;
          tong_don_hang: number;
          da_thanh_toan: number;
          so_lan_tt: number;
        }
      >();

      for (const po of poList) {
        const nccId = po.ncc_id;
        const ncc = po.nha_cung_cap;
        if (!nccMap.has(nccId)) {
          nccMap.set(nccId, {
            ncc_id: nccId,
            ma_ncc: ncc?.ma_ncc || "—",
            ten_ncc: ncc?.ten_ncc || "—",
            tong_don_hang: 0,
            da_thanh_toan: 0,
            so_lan_tt: 0,
          });
        }
        const entry = nccMap.get(nccId)!;
        entry.tong_don_hang += po.tong_tien || 0;
      }

      for (const pay of payList) {
        const nccId = pay.ncc_id;
        if (nccMap.has(nccId)) {
          const entry = nccMap.get(nccId)!;
          entry.da_thanh_toan += pay.so_tien || 0;
          entry.so_lan_tt += 1;
        } else {
          // Payment without matching PO (edge case)
          const ncc = pay.nha_cung_cap;
          nccMap.set(nccId, {
            ncc_id: nccId,
            ma_ncc: ncc?.ma_ncc || "—",
            ten_ncc: ncc?.ten_ncc || "—",
            tong_don_hang: 0,
            da_thanh_toan: pay.so_tien || 0,
            so_lan_tt: 1,
          });
        }
      }

      const summaries: NCCSummary[] = Array.from(nccMap.values()).map(
        (entry) => {
          const conNo = entry.tong_don_hang - entry.da_thanh_toan;
          let trangThai = "Chua TT";
          if (entry.tong_don_hang > 0 && conNo <= 0) {
            trangThai = "Da tat toan";
          } else if (entry.da_thanh_toan > 0) {
            trangThai = "Dang tra dan";
          }
          return {
            ...entry,
            con_no: conNo > 0 ? conNo : 0,
            trang_thai: trangThai,
          };
        }
      );

      // Sort: unpaid first, then by amount desc
      summaries.sort((a, b) => b.con_no - a.con_no);
      setNccSummaries(summaries);
    } catch {
      setNccSummaries([]);
    } finally {
      setLoadingSummaries(false);
    }
  }, []);

  // Fetch payment history
  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(paymentPage));
      params.set("limit", String(paymentLimit));
      if (paymentSearch) params.set("search", paymentSearch);
      if (paymentFromDate) params.set("from_date", paymentFromDate);
      if (paymentToDate) params.set("to_date", paymentToDate);

      const res = await fetch(`/api/wms/thanh-toan-ncc?${params}`);
      const data = await res.json();
      setPayments(data?.data || []);
      setPaymentTotal(data?.total ?? 0);
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, [paymentPage, paymentSearch, paymentFromDate, paymentToDate]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchNCCSummaries();
  }, [fetchStats, fetchNCCSummaries]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Submit single payment
  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNcc) return;
    const amount = parseFloat(soTien);
    if (!amount || amount <= 0) {
      setSubmitError("So tien phai lon hon 0");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await fetch("/api/wms/thanh-toan-ncc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncc_id: selectedNcc.id,
          phieu_dat_hang_id: selectedPO || null,
          so_tien: amount,
          ngay_thanh_toan: ngayTT,
          phuong_thuc: phuongThuc,
          ghi_chu: ghiChu || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.error || "Loi tao thanh toan");
      } else {
        setSubmitSuccess("Thanh toan thanh cong!");
        setSoTien("");
        setGhiChu("");
        setSelectedPO("");
        // Refresh data
        fetchStats();
        fetchPayments();
        fetchNCCSummaries();
        // Re-fetch POs for the selected NCC
        setSelectedNcc({ ...selectedNcc });
        setTimeout(() => setSubmitSuccess(""), 3000);
      }
    } catch {
      setSubmitError("Loi ket noi server");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle phieu chi confirm
  async function handlePhieuChiConfirm(
    paymentRows: Array<{
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
  ) {
    try {
      const batch = paymentRows.map((r) => ({
        ncc_id: r.ncc_id,
        phieu_dat_hang_id: r.phieu_dat_hang_id || null,
        so_tien: r.so_tien,
        ngay_thanh_toan: metadata.ngay,
        phuong_thuc: metadata.phuongThuc,
        ghi_chu: r.ghi_chu
          ? `[${metadata.soPhieu}] ${r.ghi_chu}`
          : `[${metadata.soPhieu}] ${metadata.ghiChu || ""}`.trim(),
      }));

      const res = await fetch("/api/wms/thanh-toan-ncc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch }),
      });

      if (res.ok) {
        setShowPhieuChi(false);
        fetchStats();
        fetchPayments();
        fetchNCCSummaries();
      }
    } catch {
      /* ignore */
    }
  }

  // Delete payment
  async function handleDeletePayment(id: string) {
    if (!confirm("Xoa thanh toan nay?")) return;
    try {
      await fetch(`/api/wms/thanh-toan-ncc?id=${id}`, { method: "DELETE" });
      fetchPayments();
      fetchStats();
      fetchNCCSummaries();
    } catch {
      /* ignore */
    }
  }

  // Payment history total
  const paymentHistoryTotal = useMemo(
    () => payments.reduce((sum, p) => sum + (p.so_tien || 0), 0),
    [payments]
  );

  return (
    <div className="space-y-6">
      {/* Phieu Chi Panel toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowPhieuChi(true)}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Lap Phieu Chi
        </button>
      </div>

      {showPhieuChi && (
        <PhieuChiPanel
          onConfirm={handlePhieuChiConfirm}
          onClose={() => setShowPhieuChi(false)}
        />
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingStats ? (
          <div className="col-span-full py-4 text-center text-sm text-gray-400">
            Dang tai thong ke...
          </div>
        ) : stats ? (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500">
                Tong cong no
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {formatMoney(stats.total_debt)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500">Da TT</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatMoney(stats.total_paid)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500">
                Con phai tra
              </p>
              <p className="mt-1 text-2xl font-bold text-orange-600">
                {formatMoney(stats.outstanding)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-medium text-gray-500">Hom nay</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {formatMoney(stats.today_paid)}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Payment Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
          Tao thanh toan
        </h3>

        {submitError && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-600 dark:bg-green-950/30">
            {submitSuccess}
          </div>
        )}

        <form onSubmit={handleSubmitPayment}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Nha cung cap *
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
                placeholder="Tim NCC theo ma hoac ten..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                So PO
              </label>
              <select
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
                disabled={!selectedNcc || loadingPOs}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">— Khong chon —</option>
                {nccPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.ma_phieu} (Con: {formatMoney(po.remaining)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                So tien *
              </label>
              <input
                type="number"
                min="0"
                value={soTien}
                onChange={(e) => setSoTien(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngay TT
              </label>
              <input
                type="date"
                value={ngayTT}
                onChange={(e) => setNgayTT(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Phuong thuc
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
                Ghi chu
              </label>
              <input
                type="text"
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="VD: Thanh toan dot 1"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>

          {/* NCC Summary box */}
          {selectedNcc && nccSummaryInfo && (
            <div className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 sm:grid-cols-4 dark:border-blue-900 dark:bg-blue-950/30">
              <div>
                <p className="text-xs text-gray-500">Tong cong no</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatMoney(nccSummaryInfo.totalDebt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Da TT</p>
                <p className="text-sm font-semibold text-green-600">
                  {formatMoney(nccSummaryInfo.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Con phai tra</p>
                <p className="text-sm font-semibold text-orange-600">
                  {formatMoney(nccSummaryInfo.remaining)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">So don con no</p>
                <p className="text-sm font-semibold text-red-600">
                  {nccSummaryInfo.unpaidCount}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              type="submit"
              disabled={submitting || !selectedNcc}
              className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Dang xu ly..." : "Tao thanh toan"}
            </button>
          </div>
        </form>
      </div>

      {/* NCC Payment Summary Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Tong hop cong no NCC
          </h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ma NCC
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ten cong ty
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Tong don hang
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Da TT
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Con no
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  So lan TT
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  Trang thai
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingSummaries ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Dang tai...
                  </td>
                </tr>
              ) : nccSummaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Chua co du lieu
                  </td>
                </tr>
              ) : (
                nccSummaries.map((s) => {
                  const pct =
                    s.tong_don_hang > 0
                      ? Math.min(
                          100,
                          (s.da_thanh_toan / s.tong_don_hang) * 100
                        )
                      : 0;
                  return (
                    <tr
                      key={s.ncc_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                        {s.ma_ncc}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                        {s.ten_ncc}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(s.tong_don_hang)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div>
                          <span className="text-green-600">
                            {formatMoney(s.da_thanh_toan)}
                          </span>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="h-1.5 rounded-full bg-green-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">
                        {formatMoney(s.con_no)}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">
                        {s.so_lan_tt}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.trang_thai === "Da tat toan"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                              : s.trang_thai === "Dang tra dan"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          }`}
                        >
                          {s.trang_thai}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Lich su thanh toan
          </h3>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <input
            type="text"
            placeholder="Tim kiem..."
            value={paymentSearch}
            onChange={(e) => {
              setPaymentSearch(e.target.value);
              setPaymentPage(1);
            }}
            className="w-48 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={paymentFromDate}
              onChange={(e) => {
                setPaymentFromDate(e.target.value);
                setPaymentPage(1);
              }}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <span className="text-xs text-gray-400">den</span>
            <input
              type="date"
              value={paymentToDate}
              onChange={(e) => {
                setPaymentToDate(e.target.value);
                setPaymentPage(1);
              }}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ngay TT
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ma NCC
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ten cong ty
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  So PO
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  So tien
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  Phuong thuc
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Ghi chu
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  Xoa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingPayments ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Dang tai...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Chua co thanh toan
                  </td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr
                    key={pay.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                      {new Date(pay.ngay_thanh_toan).toLocaleDateString(
                        "vi-VN"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                      {pay.nha_cung_cap?.ma_ncc || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                      {pay.nha_cung_cap?.ten_ncc || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {pay.phieu_dat_hang?.ma_phieu || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(pay.so_tien)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                        {PHUONG_THUC_LABELS[pay.phuong_thuc] ||
                          pay.phuong_thuc}
                      </span>
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-2 text-xs text-gray-500">
                      {pay.ghi_chu || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDeletePayment(pay.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Xoa"
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
            {payments.length > 0 && (
              <tfoot className="border-t border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-gray-500">
                    Tong trang nay:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatMoney(paymentHistoryTotal)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {paymentTotal > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-800">
            <span className="text-gray-500">
              Hien thi{" "}
              {(paymentPage - 1) * paymentLimit + 1}–
              {Math.min(paymentPage * paymentLimit, paymentTotal)} /{" "}
              {paymentTotal} thanh toan
            </span>
            <div className="flex gap-1">
              <button
                disabled={paymentPage <= 1}
                onClick={() => setPaymentPage(1)}
                className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
              >
                &laquo;&laquo;
              </button>
              <button
                disabled={paymentPage <= 1}
                onClick={() => setPaymentPage((p) => p - 1)}
                className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
              >
                &laquo;
              </button>
              <span className="px-3 py-1 text-xs font-medium">
                Trang {paymentPage} / {paymentTotalPages}
              </span>
              <button
                disabled={paymentPage >= paymentTotalPages}
                onClick={() => setPaymentPage((p) => p + 1)}
                className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
              >
                &raquo;
              </button>
              <button
                disabled={paymentPage >= paymentTotalPages}
                onClick={() => setPaymentPage(paymentTotalPages)}
                className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
              >
                &raquo;&raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
