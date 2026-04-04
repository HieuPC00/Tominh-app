import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

// Middleware chính của ứng dụng — chạy trước mỗi request
// Cập nhật phiên đăng nhập (session) Supabase cho người dùng
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Cấu hình đường dẫn áp dụng middleware
export const config = {
  matcher: [
    /*
     * Áp dụng cho tất cả đường dẫn, ngoại trừ:
     * - _next/static (file tĩnh)
     * - _next/image (tối ưu hình ảnh)
     * - favicon.ico, sitemap.xml, robots.txt (file meta)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
