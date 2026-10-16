create table if not exists corporate_actions (
  id text primary key,
  symbol text not null,
  ex_date date not null,
  record_date date,
  payment_date date,
  action_type text not null check (action_type in ('CASH_DIVIDEND', 'STOCK_DIVIDEND')),
  distribution_pct numeric not null check (distribution_pct > 0),
  reference_price numeric not null check (reference_price > 0),
  notes text,
  source text not null default 'MANUAL',
  source_key text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists corporate_actions_active_event_idx
  on corporate_actions (symbol, ex_date, action_type)
  where deleted_at is null;

create index if not exists corporate_actions_active_date_idx
  on corporate_actions (ex_date, symbol)
  where deleted_at is null;

alter table transactions
  add column if not exists corporate_action_id text
  references corporate_actions(id) on delete set null;
