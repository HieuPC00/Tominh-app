# Tominh App — Quản lý kinh doanh & Bán hàng

## Mô tả
Web app quản lý kinh doanh tổng hợp, bao gồm bán hàng online và quản lý nội bộ.

## Kiến trúc
- Frontend: Next.js (React) + TypeScript
- Styling: Tailwind CSS
- Backend: Next.js API Routes
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Deploy: Vercel

## Các module chính
### Bán hàng (E-commerce)
- Trang sản phẩm
- Giỏ hàng
- Thanh toán
- Theo dõi đơn hàng

### Quản lý (Admin)
- Dashboard tổng quan
- Quản lý sản phẩm (CRUD)
- Quản lý đơn hàng
- Quản lý khách hàng
- Quản lý kho
- Báo cáo doanh thu

## Quy tắc code
- Dùng TypeScript strict mode
- Mỗi component một file
- API routes trong /app/api/
- Dùng Supabase client cho database
- Mobile-first responsive design
