-- ============================================================
-- Migration 02: thêm đại lý (VSG/VDS) + cho phép sửa/xoá qua trang
-- Quản trị + sửa audit_log để KHÔNG mất lịch sử khi xoá bản ghi
-- Dán đoạn này vào Supabase > SQL Editor > Run (1 lần)
-- ============================================================

-- 1. Thêm cột đại lý vào service_records
alter table service_records
  add column if not exists dai_ly text check (dai_ly in ('VSG','VDS'));

-- 2. Cho phép xoá bản ghi qua app (trước đây chỉ có select/insert/update)
drop policy if exists "anon_delete_service_records" on service_records;
create policy "anon_delete_service_records" on service_records
  for delete using (auth.role() in ('authenticated', 'anon'));

-- 3. Cho phép thêm/sửa nhân sự (trang Quản trị quản lý danh sách CVDV)
drop policy if exists "anon_write_staff" on staff;
create policy "anon_write_staff" on staff
  for insert with check (auth.role() in ('authenticated', 'anon'));
drop policy if exists "anon_update_staff" on staff;
create policy "anon_update_staff" on staff
  for update using (auth.role() in ('authenticated', 'anon'));

-- 4. QUAN TRỌNG: sửa audit_log để khi xoá 1 bản ghi service_records thì
--    KHÔNG xoá luôn lịch sử của nó (trước đây là "on delete cascade" -
--    nghĩa là xoá xe sẽ xoá mất cả dấu vết, ngược với mục đích audit log).
alter table audit_log drop constraint if exists audit_log_record_id_fkey;
alter table audit_log add constraint audit_log_record_id_fkey
  foreign key (record_id) references service_records(id) on delete set null;
