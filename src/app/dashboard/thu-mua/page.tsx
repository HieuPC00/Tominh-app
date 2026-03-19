"use client";

import { useState } from "react";
import HomeTab from "./tabs/home-tab";
import CongNoTab from "./tabs/cong-no-tab";
import TongHopTab from "./tabs/tong-hop-tab";
import ThanhToanTab from "./tabs/thanh-toan-tab";
import BaoCaoTab from "./tabs/bao-cao-tab";
import DanhMucTab from "./tabs/danh-muc-tab";

const tabs = [
  { id: "home", label: "Trang Chủ", icon: "🏠" },
  { id: "congno", label: "Công Nợ Đơn Lẻ", icon: "📋" },
  { id: "tonghop", label: "Tổng Hợp NCC", icon: "📊" },
  { id: "thanhtoan", label: "Thanh Toán", icon: "💳" },
  { id: "baocao", label: "Báo Cáo", icon: "📑" },
  { id: "danhmuc", label: "Danh Mục", icon: "⚙️" },
];

export default function ThuMuaPage() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quản lý Thu Mua</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "home" && <HomeTab onTabChange={setActiveTab} />}
      {activeTab === "congno" && <CongNoTab />}
      {activeTab === "tonghop" && <TongHopTab />}
      {activeTab === "thanhtoan" && <ThanhToanTab />}
      {activeTab === "baocao" && <BaoCaoTab />}
      {activeTab === "danhmuc" && <DanhMucTab />}
    </div>
  );
}
