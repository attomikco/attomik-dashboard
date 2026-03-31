-- Add sync_timestamps table to track last sync time per source per org
create table if not exists sync_timestamps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  source text not null check (source in ('shopify', 'amazon', 'meta')),
  last_synced_at timestamptz not null default now(),
  unique(org_id, source)
);

-- RLS
alter table sync_timestamps enable row level security;

create policy "org sync timestamps only" on sync_timestamps
  for all using (org_id = (select org_id from profiles where id = auth.uid()));
