"use client";

import { useEffect, useState, useCallback } from "react";
import type { PhieuDatHang } from "@/types/wms";

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

interface Stats {
  total_po: number;
  total_debt: number;
  total_paid: number;
  outstanding: number;
  today_paid: number;
}

interface HomeTabProps {
  onTabChange?: (tab: string) => void;
}

export default function HomeTab({ onTabChange }: HomeTabProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<PhieuDatHang[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorStats, setErrorStats] = useState("");
  const [errorOrders, setErrorOrders] = useState("");

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats("");
    try {
      const res = await fetch("/api/wms/thu-mua/stats");
      if (!res.ok) throw new Error("Loi tai du lieu thong ke");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setErrorStats(
        err instanceof Error ? err.message : "Loi tai du lieu thong ke"
      );
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    setLoadingOrders(true);
    setErrorOrders("");
    try {
      const res = await fetch("/api/wms/phieu-dat-hang?limit=5&page=1");
      if (!res.ok) throw new Error("Loi tai danh sach don hang");
      const data = await res.json();
      setRecentOrders(data?.data || []);
    } catch (err) {
      setErrorOrders(
        err instanceof Error ? err.message : "Loi tai danh sach don hang"
      );
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecentOrders();
  }, [fetchStats, fetchRecentOrders]);

  function formatMoney(n: number): string {
    return n.toLocaleString("vi-VN");
  }

  const quickLinks = [
    {
      id: "cong-no",
      label: "Cong No Don Le",
      desc: "Quan ly phieu dat hang",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      color:
        "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    },
    {
      id: "tong-hop",
      label: "Tong Hop NCC",
      desc: "Bang cong no tong hop",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
      color:
        "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800",
    },
    {
      id: "thanh-toan",
      label: "Thanh Toan",
      desc: "Lap phieu chi NCC",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      color:
        "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    },
    {
      id: "bao-cao",
      label: "Bao Cao",
      desc: "Bao cao thu mua",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      color:
        "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
    },
    {
      id: "danh-muc",
      label: "Danh Muc",
      desc: "Hang hoa, NCC, Kho",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      ),
      color:
        "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tong don hang */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Tong don hang
              </p>
              {loadingStats ? (
                <div className="mt-1 h-8 w-20 animate-pulse rounded bg-blue-200 dark:bg-blue-800" />
              ) : errorStats ? (
                <p className="mt-1 text-sm text-red-500">{errorStats}</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {stats?.total_po ?? 0}
                </p>
              )}
            </div>
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Tong cong no */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                Tong cong no
              </p>
              {loadingStats ? (
                <div className="mt-1 h-8 w-28 animate-pulse rounded bg-yellow-200 dark:bg-yellow-800" />
              ) : errorStats ? (
                <p className="mt-1 text-sm text-red-500">--</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {formatMoney(stats?.total_debt ?? 0)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-yellow-100 p-2 dark:bg-yellow-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Da thanh toan */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                Da thanh toan
              </p>
              {loadingStats ? (
                <div className="mt-1 h-8 w-28 animate-pulse rounded bg-green-200 dark:bg-green-800" />
              ) : errorStats ? (
                <p className="mt-1 text-sm text-red-500">--</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatMoney(stats?.total_paid ?? 0)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Con phai tra */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Con phai tra
              </p>
              {loadingStats ? (
                <div className="mt-1 h-8 w-28 animate-pulse rounded bg-red-200 dark:bg-red-800" />
              ) : errorStats ? (
                <p className="mt-1 text-sm text-red-500">--</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                  {formatMoney(stats?.outstanding ?? 0)}
                </p>
              )}
            </div>
            <div className="rounded-full bg-red-100 p-2 dark:bg-red-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick navigation */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Truy cap nhanh
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {quickLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onTabChange?.(link.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-md ${link.color}`}
            >
              <div className="shrink-0">{link.icon}</div>
              <div>
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs opacity-70">{link.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Don hang gan day
          </h3>
          <button
            onClick={() => onTabChange?.("cong-no")}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Xem tat ca
          </button>
        </div>

        <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  So PO
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  Ten cong ty
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Tong tien
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">
                  Trang thai
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingOrders ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
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
              ) : errorOrders ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-red-500"
                  >
                    {errorOrders}
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Chua co don hang nao
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => {
                  const sc = STATUS_COLORS[order.trang_thai] || {
                    text: "text-gray-600",
                    bg: "bg-gray-50 dark:bg-gray-900",
                    border: "border-gray-300",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                          {order.ma_phieu}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2 text-gray-900 dark:text-gray-100">
                        {order.nha_cung_cap?.ten_ncc || "--"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney(order.tong_tien)}
                      </td>
                      <td className="px-4 py-2 text-center">
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
      </div>
    </div>
  );
}
