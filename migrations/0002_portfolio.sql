-- Shared Asset-Only ledger. Authenticated users all read/write the same book.
-- Original Capital lives only in capital_movements (Dashboard Nạp/Rút).

create table if not exists accounts (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('STOCK_VPS','STOCK_SSI','CRYPTO','ETF','DCDS','BANK')),
  currency text not null default 'VND',
  created_at timestamptz not null default now()
);

insert into accounts (id, name, kind, currency) values
  ('vps', 'VPS', 'STOCK_VPS', 'VND'),
  ('ssi', 'SSI', 'STOCK_SSI', 'VND'),
  ('crypto', 'Crypto', 'CRYPTO', 'USD'),
  ('etf', 'ETF', 'ETF', 'VND'),
  ('dcds', 'DCDS', 'DCDS', 'VND'),
  ('bank', 'Bank', 'BANK', 'VND')
on conflict (id) do nothing;

create table if not exists assets (
  id text primary key,
  account_id text not null references accounts(id) on delete restrict,
  symbol text not null,
  name text not null default '',
  asset_type text not null check (asset_type in ('STOCK','ETF','DCDS','CRYPTO')),
  currency text not null,
  current_price numeric,
  price_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, symbol)
);

create table if not exists capital_movements (
  id text primary key,
  kind text not null check (kind in ('DEPOSIT','WITHDRAW')),
  amount numeric not null,
  movement_date date not null,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key,
  account_id text not null references accounts(id) on delete restrict,
  asset_id text references assets(id) on delete restrict,
  tx_type text not null check (tx_type in ('BUY','SELL','CASH_DIVIDEND','STOCK_DIVIDEND')),
  tx_date date not null,
  quantity numeric,
  price numeric,
  amount numeric not null default 0,
  fee numeric not null default 0,
  tax numeric not null default 0,
  trade_tplus boolean not null default false,
  fx_rate numeric,
  dividend_per_share numeric,
  stock_div_qty numeric,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists transactions_active_date_idx
  on transactions (tx_date, created_at)
  where deleted_at is null;

create table if not exists tplus_matches (
  id text primary key,
  sell_tx_id text not null references transactions(id) on delete cascade,
  buy_tx_id text not null references transactions(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists bank_deposits (
  id text primary key,
  bank_name text not null,
  principal numeric not null,
  start_date date not null,
  term_months integer not null check (term_months > 0),
  interest_rate numeric not null,
  auto_rollover boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REDEEMED')),
  redeemed_at date,
  redeemed_principal numeric,
  redeemed_interest numeric,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bank_rate_updates (
  id text primary key,
  deposit_id text not null references bank_deposits(id) on delete cascade,
  period_number integer not null,
  interest_rate numeric not null,
  confirmed_at timestamptz not null default now(),
  unique (deposit_id, period_number)
);

create table if not exists fee_settings (
  profile text primary key check (profile in ('STOCK_VPS','STOCK_SSI','CRYPTO','DCDS','ETF')),
  buy_fee_pct numeric not null default 0,
  sell_fee_pct numeric not null default 0,
  sell_tax_pct numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into fee_settings (profile, buy_fee_pct, sell_fee_pct, sell_tax_pct) values
  ('STOCK_VPS', 0.15, 0.15, 0.1),
  ('STOCK_SSI', 0.15, 0.15, 0.1),
  ('CRYPTO', 0.1, 0.1, 0),
  ('DCDS', 0, 0, 0),
  ('ETF', 0, 0, 0)
on conflict (profile) do nothing;

create table if not exists app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into app_meta (key, value) values
  ('usd_vnd', '25000')
on conflict (key) do nothing;
