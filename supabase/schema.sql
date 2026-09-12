-- ============================================================
--  SCHEMA: Ứng dụng Kiểm Soát Xe Ra/Vào — Volvo Car Saigon
--  Chạy toàn bộ file này trong Supabase > SQL Editor (1 lần duy nhất)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. Bảng nhân sự ----------
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  ho_ten text not null,
  vai_tro text not null check (vai_tro in ('cvdv','ke_toan','bao_ve','crm','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 2. Cấu hình sức chứa theo khung giờ (cho bảng lịch hẹn) ----------
create table if not exists cau_hinh_khung_gio (
  id uuid primary key default gen_random_uuid(),
  gio_bat_dau time not null,
  gio_ket_thuc time not null,
  suc_chua_toi_da integer not null default 5
);

-- ---------- 3. Bảng chính: mỗi dòng là 1 lượt xe ra/vào ----------
create table if not exists service_records (
  id uuid primary key default gen_random_uuid(),
  bien_so text not null,
  loai text not null default 'hen' check (loai in ('hen','vang_lai','giam_dinh')),

  gio_hen timestamptz,              -- null nếu là xe vãng lai
  noi_dung text,
  cvdv_id uuid references staff(id),

  gio_vao timestamptz,              -- bảo vệ ghi nhận khi xe vào cổng
  km numeric,
  nguoi_xac_nhan_vao uuid references staff(id),

  so_phieu text,                    -- số phiếu ra cổng (có thể để trống, chỉ ghi thời gian)
  ngay_gio_phieu timestamptz,
  nguoi_xac_nhan_phieu uuid references staff(id),

  gio_ra timestamptz,               -- null = xe chưa ra cổng
  nguoi_xac_nhan_ra uuid references staff(id),

  ly_do_doi_huy text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_records_bien_so on service_records (bien_so);
create index if not exists idx_service_records_gio_hen on service_records (gio_hen);
create index if not exists idx_service_records_chua_ra on service_records (gio_ra) where gio_ra is null;

-- ---------- 4. Nhật ký thao tác (audit log) ----------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references service_records(id) on delete cascade,
  hanh_dong text not null,          -- vd: xac_nhan_vao, xac_nhan_phieu, xac_nhan_ra, sua_gio_ra
  nguoi_thuc_hien uuid references staff(id),
  thoi_gian timestamptz not null default now(),
  gia_tri_cu jsonb,
  gia_tri_moi jsonb
);

-- ---------- 5. Tự động cập nhật updated_at ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_service_records_updated_at on service_records;
create trigger trg_service_records_updated_at
  before update on service_records
  for each row execute function set_updated_at();

-- ---------- 6. Row Level Security (bật cơ bản, tinh chỉnh sau ở Phase 2) ----------
alter table service_records enable row level security;
alter table staff enable row level security;
alter table audit_log enable row level security;
alter table cau_hinh_khung_gio enable row level security;

-- Phase 1 CHƯA có Supabase Auth (app gọi thẳng bằng publishable/anon key,
-- không đăng nhập) nên tạm thời cho phép cả role 'anon' đọc/ghi.
-- ⚠️ Đây là công cụ nội bộ (bảo vệ dùng trong công ty) — khi làm Phase 2
-- (thêm đăng nhập), nhớ đổi lại thành auth.role() = 'authenticated' và
-- thu hẹp theo vai trò (xem mục 5 trong README.md).
create policy "anon_read_service_records" on service_records
  for select using (auth.role() in ('authenticated', 'anon'));
create policy "anon_write_service_records" on service_records
  for insert with check (auth.role() in ('authenticated', 'anon'));
create policy "anon_update_service_records" on service_records
  for update using (auth.role() in ('authenticated', 'anon'));

create policy "anon_read_staff" on staff
  for select using (auth.role() in ('authenticated', 'anon'));

create policy "anon_read_audit" on audit_log
  for select using (auth.role() in ('authenticated', 'anon'));
create policy "anon_write_audit" on audit_log
  for insert with check (auth.role() in ('authenticated', 'anon'));

create policy "anon_read_khung_gio" on cau_hinh_khung_gio
  for select using (auth.role() in ('authenticated', 'anon'));

-- ---------- 7. Dữ liệu mẫu (xóa dòng dưới nếu không cần) ----------
-- generate_series không nhận kiểu `time` trực tiếp, nên dùng timestamp
-- rồi ép lại về time.
insert into cau_hinh_khung_gio (gio_bat_dau, gio_ket_thuc, suc_chua_toi_da)
select t::time, (t + interval '30 minutes')::time, 5
from generate_series(
  timestamp '2000-01-01 07:00',
  timestamp '2000-01-01 18:30',
  interval '30 minutes'
) t
on conflict do nothing;
