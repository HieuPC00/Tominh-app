"use client";

import { useEffect, useState } from "react";
import type { KhoHang } from "@/types/wms";

const LABEL_TRANG_THAI: Record<string, string> = {
  yeu_cau: "Yêu cầu",
  duyet: "Đã duyệt",
  dang_chuyen: "Đang chuyển",
  da_nhan: "Đã nhận",
  huy: "Hủy",
};

const COLOR_TRANG_THAI: Record<string, string> = {
  yeu_cau: "bg-blue-100 text-blue-700",
  duyet: "bg-yellow-100 text-yellow-700",
  dang_chuyen: "bg-purple-100 text-purple-700",
  da_nhan: "bg-green-100 text-green-700",
  huy: "bg-red-100 text-red-600",
};

export default function ChuyenKhoTab() {
  const [khoList, setKhoList] = useState<KhoHang[]>([]);

  useEffect(() => {
    fetch("/api/wms/kho").then((r) => r.json()).then((d) => Array.isArray(d) && setKhoList(d));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Chuyển hàng giữa các kho</p>
        <button className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
          + Tạo yêu cầu chuyển kho
        </button>
      </div>

      {/* Info card */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
        <h3 className="mb-2 font-medium">Luồng chuyển kho</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Yêu cầu</span>
          <span>→</span>
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Duyệt</span>
          <span>→</span>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Đang chuyển</span>
          <span>→</span>
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Đã nhận</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Kho A xuất hàng → Vận chuyển → Kho B xác nhận nhận → Lot mới được tạo ở kho B (kế thừa HSD, NSX, giá)
        </p>
      </div>

      {/* Danh sách kho để chuyển */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {khoList.map((kho) => (
          <div key={kho.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="font-medium">{kho.ten_kho}</p>
            <p className="text-xs text-gray-500">{kho.ma_kho} — {kho.dia_chi || "Chưa có địa chỉ"}</p>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              kho.trang_thai === "hoat_dong" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}>
              {kho.trang_thai === "hoat_dong" ? "Hoạt động" : kho.trang_thai}
            </span>
          </div>
        ))}
        {khoList.length === 0 && (
          <p className="col-span-full py-8 text-center text-gray-400">Chưa có kho nào. Thêm kho trong tab Danh mục.</p>
        )}
      </div>

      {/* Placeholder table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Mã CK</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Kho xuất → Kho nhận</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Ngày</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Chưa có phiếu chuyển kho nào</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
