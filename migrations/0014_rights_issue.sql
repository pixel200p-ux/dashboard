alter table corporate_actions
  drop constraint if exists corporate_actions_action_type_check;

alter table corporate_actions
  add constraint corporate_actions_action_type_check
  check (action_type in ('CASH_DIVIDEND', 'STOCK_DIVIDEND', 'RIGHTS_ISSUE'));

alter table corporate_actions
  alter column reference_price drop not null,
  add column if not exists subscription_price numeric,
  add column if not exists vps_subscribed_qty numeric not null default 0,
  add column if not exists ssi_subscribed_qty numeric not null default 0;

alter table corporate_actions
  add constraint corporate_actions_rights_terms_check
  check (
    (action_type = 'RIGHTS_ISSUE' and subscription_price > 0)
    or (action_type <> 'RIGHTS_ISSUE' and subscription_price is null)
  ),
  add constraint corporate_actions_subscribed_qty_check
  check (
    vps_subscribed_qty >= 0
    and ssi_subscribed_qty >= 0
    and vps_subscribed_qty = trunc(vps_subscribed_qty)
    and ssi_subscribed_qty = trunc(ssi_subscribed_qty)
  );
