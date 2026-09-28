-- Liên kết khoản Original tự tạo với lệnh Buy/Mở sổ nguồn.
alter table capital_movements
  add column if not exists source_type text;

alter table capital_movements
  add column if not exists source_id text;

create unique index if not exists capital_movements_source_unique
  on capital_movements (source_type, source_id)
  where source_type is not null and source_id is not null;
