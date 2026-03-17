"use client";

const LABEL_LY_DO: Record<string, string> = {
  het_hsd: "Hết HSD",
  hong: "Hỏng",
  loi_bao_quan: "Lỗi bảo quản",
  kiem_ke_thieu: "Kiểm kê thiếu",
  khac: "Khác",
};

const LABEL_TRANG_THAI: Record<string, string> = {
  cho_duyet: "Chờ duyệt",
  da_huy: "Đã hủy",
  tu_choi: "Từ chối",
};

const COLOR_TRANG_THAI: Record<string, string> = {
  cho_duyet: "bg-yellow-100 text-yellow-700",
  da_huy: "bg-red-100 text-red-600",
  tu_choi: "bg-gray-100 text-gray-600",
};

export default function HuyHangTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Quản lý hủy hàng hóa hỏng, hết HSD</p>
        <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          + Tạo phiếu hủy
        </button>
      </div>

      {/* Waste info */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <h3 className="mb-2 font-medium">Lý do hủy hàng</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LABEL_LY_DO).map(([key, label]) => (
            <span key={key} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
              {label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Phiếu hủy cần được duyệt bởi Quản kho/Trưởng phòng. Waste Rate = Tổng hủy / Tổng nhập x 100%.
        </p>
      </div>

      {/* Placeholder table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Mã phiếu</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Hàng hóa</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Lô</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">SL hủy</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Giá trị</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Lý do</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Chưa có phiếu hủy nào</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
