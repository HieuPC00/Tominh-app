"use client";

import { useEffect, useState, useCallback } from "react";
import type { KhoHang } from "@/types/wms";

interface TonKhoSummary {
  kho_id: string;
  kho: KhoHang;
  total_sku: number;
  total_value: number;
  canh_bao_min: number;
  canh_bao_hsd: number;
}

interface HangHoaTonKho {
  id: string;
  ma_hang_hoa: string;
  ten: string;
  so_luong_ton: number;
  ton_toi_thieu: number;
  ton_toi_da: number;
  phan_loai?: { ten_phan_loai: string };
  don_vi_tinh?: { ten_dvt: string };
}

const LABEL_LOAI_KHO: Record<string, string> = {
  trung_tam: "Kho trung tâm",
  cua_hang: "Kho cửa hàng",
  tam: "Kho tạm",
};

export default function DashboardTonKho() {
  const [khoList, setKhoList] = useState<KhoHang[]>([]);
  const [selectedKho, setSelectedKho] = useState<string>("");
  const [hangHoaList, setHangHoaList] = useState<HangHoaTonKho[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/wms/kho")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setKhoList(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchTonKho = useCallback(async () => {
    if (!selectedKho) {
      setHangHoaList([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ kho_id: selectedKho });
    if (search) params.set("search", search);

    const res = await fetch(`/api/wms/ton-kho?${params}`);
    const data = await res.json();
    setHangHoaList(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [selectedKho, search]);

  useEffect(() => {
    fetchTonKho();
  }, [fetchTonKho]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500">Tổng kho</p>
          <p className="mt-1 text-3xl font-bold">{khoList.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500">Kho trung tâm</p>
          <p className="mt-1 text-3xl font-bold">
            {khoList.filter((k) => k.loai_kho === "trung_tam").length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500">Kho cửa hàng</p>
          <p className="mt-1 text-3xl font-bold">
            {khoList.filter((k) => k.loai_kho === "cua_hang").length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500">Đang hoạt động</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {khoList.filter((k) => k.trang_thai === "hoat_dong").length}
          </p>
        </div>
      </div>

      {/* Warehouse List */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 className="font-medium">Danh sách kho</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {khoList.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400">
              {loading ? "Đang tải..." : "Chưa có kho nào. Thêm kho trong tab Danh mục."}
            </p>
          ) : (
            khoList.map((kho) => (
              <button
                key={kho.id}
                onClick={() => setSelectedKho(kho.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
                  selectedKho === kho.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <div>
                  <p className="font-medium">{kho.ten_kho}</p>
                  <p className="text-xs text-gray-500">
                    {kho.ma_kho} — {LABEL_LOAI_KHO[kho.loai_kho] || kho.loai_kho}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    kho.trang_thai === "hoat_dong"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {kho.trang_thai === "hoat_dong" ? "Hoạt động" : kho.trang_thai}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Drill-down: Hàng hóa tồn kho theo kho */}
      {selectedKho && (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h3 className="font-medium">
              Tồn kho — {khoList.find((k) => k.id === selectedKho)?.ten_kho}
            </h3>
            <input
              type="text"
              placeholder="Tìm hàng hóa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Mã</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tên hàng</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Phân loại</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Tồn kho</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Min</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Max</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Cảnh báo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Đang tải...</td>
                </tr>
              ) : hangHoaList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Chưa có dữ liệu tồn kho</td>
                </tr>
              ) : (
                hangHoaList.map((hh) => {
                  const duoiMin = hh.ton_toi_thieu > 0 && hh.so_luong_ton < hh.ton_toi_thieu;
                  const vuotMax = hh.ton_toi_da > 0 && hh.so_luong_ton > hh.ton_toi_da;
                  return (
                    <tr key={hh.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-2 font-mono text-xs">{hh.ma_hang_hoa}</td>
                      <td className="px-4 py-2">{hh.ten}</td>
                      <td className="px-4 py-2 text-gray-500">{hh.phan_loai?.ten_phan_loai || "—"}</td>
                      <td className={`px-4 py-2 text-right font-medium ${duoiMin ? "text-red-600" : ""}`}>
                        {Number(hh.so_luong_ton).toLocaleString("vi-VN")}
                        {hh.don_vi_tinh && <span className="ml-1 text-xs text-gray-400">{hh.don_vi_tinh.ten_dvt}</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{hh.ton_toi_thieu || "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{hh.ton_toi_da || "—"}</td>
                      <td className="px-4 py-2 text-center">
                        {duoiMin && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
                            Dưới min
                          </span>
                        )}
                        {vuotMax && (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                            Vượt max
                          </span>
                        )}
                        {!duoiMin && !vuotMax && <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
