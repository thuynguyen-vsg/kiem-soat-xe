# Ứng Dụng Kiểm Soát Xe Ra/Vào — Phase 1 (Module Bảo Vệ)

Đây là bản khung (scaffold) cho module quan trọng nhất theo kế hoạch triển
khai: giao diện Bảo vệ trên điện thoại, chạy trên Next.js + Supabase.

## 1. Tạo dự án Supabase

1. Vào https://supabase.com → tạo project mới (miễn phí).
2. Vào **SQL Editor** → dán toàn bộ nội dung file `supabase/schema.sql` →
   bấm Run. Việc này tạo đủ 4 bảng: `service_records`, `staff`,
   `audit_log`, `cau_hinh_khung_gio`.
3. Vào **Project Settings > API** → copy `Project URL` và `anon public key`.

## 2. Cấu hình dự án

```bash
cp .env.local.example .env.local
```

Mở `.env.local`, dán đúng `Project URL` và `anon key` vào 2 dòng tương ứng.

## 3. Chạy thử ở máy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000 — sẽ tự chuyển vào `/bao-ve`.

## 4. Triển khai thật (miễn phí)

- Đưa code này lên 1 repo GitHub.
- Vào https://vercel.com → New Project → chọn repo đó → thêm 2 biến môi
  trường giống `.env.local` → Deploy.
- Vercel sẽ cho 1 link dạng `https://ten-du-an.vercel.app` — gửi link này
  cho bảo vệ (thêm vào màn hình chính điện thoại như hướng dẫn cũ).

## 5. Việc còn thiếu (chưa làm ở bản này)

- Đăng nhập/phân quyền theo vai trò (hiện đang cho phép mọi người đã đăng
  nhập đọc/ghi — cần bổ sung Supabase Auth + Row Level Security chi tiết
  hơn ở Phase 2).
- Module CVDV (nhập lịch hẹn), Kế toán, Báo cáo — theo đúng lộ trình
  Phase 2 và Phase 3 trong tài liệu thiết kế.
- Bảng lịch hẹn theo khung giờ (mục 5.1 trong tài liệu thiết kế).
- Ghi `audit_log` mỗi khi có thao tác xác nhận (bảng đã tạo sẵn trong
  schema, nhưng code Phase 1 này chưa gọi insert vào đó).

## Cấu trúc thư mục

```
app/
  layout.tsx        - khung chung
  globals.css       - style dùng chung
  page.tsx          - tự chuyển hướng vào /bao-ve
  bao-ve/page.tsx    - toàn bộ giao diện + logic module Bảo vệ
lib/
  supabase.ts       - kết nối Supabase
supabase/
  schema.sql        - toàn bộ cấu trúc database
```
