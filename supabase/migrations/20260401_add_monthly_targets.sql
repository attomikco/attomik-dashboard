-- Add monthly_targets table for per-org monthly KPI targets and ad spend budget
create table monthly_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  year smallint not null,
  month smallint not null check (month between 1 and 12),
  sales_target numeric(12,2),
  aov_target numeric(10,2),
  cac_target numeric(10,2),
  roas_target numeric(6,2),
  ad_spend_budget numeric(12,2),
  updated_at timestamptz default now(),
  unique(org_id, year, month)
);

alter table monthly_targets enable row level security;

create policy "org monthly targets only" on monthly_targets
  for all using (org_id = (select org_id from profiles where id = auth.uid()));
