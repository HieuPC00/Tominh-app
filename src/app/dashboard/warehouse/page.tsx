"use client";

import { useState } from "react";
import DashboardTonKho from "./tabs/dashboard-tab";
import NhapKhoTab from "./tabs/nhap-kho-tab";
import XuatKhoTab from "./tabs/xuat-kho-tab";
import ChuyenKhoTab from "./tabs/chuyen-kho-tab";
import KiemKeTab from "./tabs/kiem-ke-tab";
import HuyHangTab from "./tabs/huy-hang-tab";
import DanhMucTab from "./tabs/danh-muc-tab";

const tabs = [
  { id: "dashboard", label: "Tồn kho", icon: "📊" },
  { id: "nhap-kho", label: "Nhập kho", icon: "📥" },
  { id: "xuat-kho", label: "Xuất kho", icon: "📤" },
  { id: "chuyen-kho", label: "Chuyển kho", icon: "🔄" },
  { id: "kiem-ke", label: "Kiểm kê", icon: "📋" },
  { id: "huy-hang", label: "Hủy hàng", icon: "🗑️" },
  { id: "danh-muc", label: "Danh mục", icon: "📁" },
];

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Quản lý Kho</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && <DashboardTonKho />}
      {activeTab === "nhap-kho" && <NhapKhoTab />}
      {activeTab === "xuat-kho" && <XuatKhoTab />}
      {activeTab === "chuyen-kho" && <ChuyenKhoTab />}
      {activeTab === "kiem-ke" && <KiemKeTab />}
      {activeTab === "huy-hang" && <HuyHangTab />}
      {activeTab === "danh-muc" && <DanhMucTab />}
    </div>
  );
}
