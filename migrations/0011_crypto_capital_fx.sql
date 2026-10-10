alter table capital_movements
  add column if not exists fx_rate numeric;

update capital_movements
set fx_rate = coalesce(
  (select value::numeric from app_meta where key = 'usd_vnd'),
  25000
)
where bucket = 'CRYPTO' and fx_rate is null;
