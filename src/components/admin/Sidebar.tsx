"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Tổng quan", icon: "📊" },
  { href: "/dashboard/products", label: "Sản phẩm", icon: "📦" },
  { href: "/dashboard/categories", label: "Danh mục", icon: "📁" },
  { href: "/dashboard/orders", label: "Đơn hàng", icon: "🛒" },
  { href: "/dashboard/customers", label: "Khách hàng", icon: "👥" },
  { href: "/dashboard/warehouse", label: "Quản lý Kho", icon: "🏭" },
  { href: "/dashboard/thu-mua", label: "Thu Mua", icon: "🛒" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-800">
        <Link href="/" className="text-lg font-bold">
          Tominh
        </Link>
        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          Admin
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
        >
          <span className="text-base">←</span>
          Về trang chủ
        </Link>
      </div>
    </aside>
  );
}
