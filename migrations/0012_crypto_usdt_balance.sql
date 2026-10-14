insert into app_meta (key, value) values ('crypto_usdt_balance', '0')
on conflict (key) do nothing;

create table if not exists crypto_usdt_balance_history (
  effective_date date primary key,
  amount numeric not null check (amount >= 0),
  updated_at timestamptz not null default now()
);
