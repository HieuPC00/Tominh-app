"use client";

import { useEffect, useState } from "react";
import type { KhoHang } from "@/types/wms";

const LABEL_LOAI: Record<string, string> = {
  toan_bo: "Toàn bộ",
  theo_phan_loai: "Theo phân loại",
  theo_vi_tri: "Theo vị trí",
  theo_hang_hoa: "Theo hàng hóa",
};

export default function KiemKeTab() {
  const [khoList, setKhoList] = useState<KhoHang[]>([]);

  useEffect(() => {
    fetch("/api/wms/kho").then((r) => r.json()).then((d) => Array.isArray(d) && setKhoList(d));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Kiểm kê tồn kho thực tế so với sổ sách</p>
        <button className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          + Tạo phiếu kiểm kê
        </button>
      </div>

      {/* Flow info */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/30">
        <h3 className="mb-2 font-medium">Quy trình kiểm kê</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Tạo phiếu</span>
          <span>→</span>
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Đang đếm</span>
          <span>→</span>
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Hoàn tất</span>
          <span>→</span>
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Đã điều chỉnh</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Thừa → Tạo phiếu nhập bổ sung | Thiếu → Tạo phiếu hủy/xuất điều chỉnh
        </p>
      </div>

      {/* Loại kiểm kê */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(LABEL_LOAI).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-950">
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-xs text-gray-500">
              {key === "toan_bo" && "Đếm tất cả HH trong kho"}
              {key === "theo_phan_loai" && "Đếm theo nhóm HH"}
              {key === "theo_vi_tri" && "Đếm theo bin/vị trí kho"}
              {key === "theo_hang_hoa" && "Đếm HH cụ thể"}
            </p>
          </div>
        ))}
      </div>

      {/* Placeholder table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Mã KK</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Kho</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Loại</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Ngày</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có phiếu kiểm kê nào</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
