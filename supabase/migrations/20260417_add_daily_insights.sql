-- Add daily_insights table for AI-generated per-day narratives + metric snapshots
create table daily_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  date date not null,
  summary text,
  metrics jsonb,
  created_at timestamptz default now(),
  unique(org_id, date)
);

create index daily_insights_org_date_idx on daily_insights (org_id, date desc);

alter table daily_insights enable row level security;

create policy "org daily insights only" on daily_insights
  for all using (org_id = (select org_id from profiles where id = auth.uid()));
