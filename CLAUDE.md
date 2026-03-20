# Tominh App — Quản lý kinh doanh & Bán hàng

## Mô tả
Web app quản lý kinh doanh tổng hợp, bao gồm bán hàng online và quản lý nội bộ.

## Kiến trúc
- Frontend: Next.js 16 (React 19) + TypeScript (strict)
- Styling: Tailwind CSS v4
- Backend: Next.js API Routes
- Database: Supabase (PostgreSQL) with RLS
- Auth: Supabase Auth
- AI: Groq SDK (OCR invoice) — model: meta-llama/llama-4-scout-17b-16e-instruct
- Deploy: Vercel (auto-deploy from main branch)

## GitHub & Deploy
- Repo: https://github.com/HieuPC00/Tominh-app.git
- Deploy: push to `main` → Vercel auto-deploys
- Env vars (Vercel): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GROQ_API_KEY

## Các module chính

### Bán hàng (E-commerce)
- Trang sản phẩm, Giỏ hàng, Thanh toán, Theo dõi đơn hàng

### Quản lý Kho (/dashboard/warehouse) — 7 tabs
- Dashboard, Danh mục (Kho/DVT/Phân loại), Nhập kho, Xuất kho, Chuyển kho, Kiểm kê, Hủy hàng

### Thu Mua (/dashboard/thu-mua) — 6 tabs
- Home (stats), Công Nợ (PO + OCR), Tổng Hợp NCC, Thanh Toán, Báo Cáo, Danh Mục (NCC + Hàng hóa)
- PO lifecycle: cho_xac_nhan → da_xac_nhan → dang_giao → da_nhan_hang → da_thanh_toan | huy
- OCR: upload ảnh hóa đơn → Groq Vision đọc → code match SP trong DB

## Database schemas
- supabase/schema.sql — Core e-commerce
- supabase/wms-schema.sql — Warehouse module
- supabase/purchase-schema.sql — Purchase module (phieu_dat_hang, thanh_toan_ncc)

## Quy tắc code
- Dùng TypeScript strict mode
- Mỗi component một file
- API routes trong /app/api/
- Dùng Supabase client cho database (supabase-server.ts cho server, supabase.ts cho browser)
- Mobile-first responsive design
- Supabase query: luôn dùng pagination (.range()) vì default max = 1000 rows
- Filter is_deleted: dùng .or("is_deleted.eq.false,is_deleted.is.null")
- FK join: don_vi_tinh(ten_dvt), không phải don_vi_tinh trực tiếp
