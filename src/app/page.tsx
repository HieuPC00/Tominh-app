import Link from "next/link";
import Header from "@/components/ui/Header";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-4 py-16">
        <section className="text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Quản lý kinh doanh & Bán hàng
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Nền tảng quản lý kinh doanh tổng hợp — bán hàng online, quản lý đơn
            hàng, kho hàng và báo cáo doanh thu.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/products"
              className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
            >
              Xem sản phẩm
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Vào trang quản lý
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
            >
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800">
        &copy; 2026 Tominh. All rights reserved.
      </footer>
    </div>
  );
}

const features = [
  {
    title: "Bán hàng Online",
    description:
      "Trang sản phẩm, giỏ hàng, thanh toán và theo dõi đơn hàng cho khách hàng.",
  },
  {
    title: "Quản lý Đơn hàng",
    description:
      "Theo dõi trạng thái đơn hàng từ lúc đặt đến khi giao thành công.",
  },
  {
    title: "Quản lý Kho",
    description: "Kiểm soát tồn kho, nhập xuất hàng hóa theo thời gian thực.",
  },
  {
    title: "Quản lý Sản phẩm",
    description: "Thêm, sửa, xoá sản phẩm với đầy đủ thông tin và hình ảnh.",
  },
  {
    title: "Quản lý Khách hàng",
    description: "Lưu trữ thông tin khách hàng, lịch sử mua hàng.",
  },
  {
    title: "Báo cáo Doanh thu",
    description: "Dashboard tổng quan với biểu đồ doanh thu và thống kê.",
  },
];
