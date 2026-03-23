-- ============================================
-- Attomik Dashboard — Supabase Schema
-- Run this in: Supabase > SQL Editor > New query
-- ============================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  shopify_domain text,
  shopify_token text,
  meta_ad_account_id text,
  meta_access_token text,
  ga_property_id text,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role text default 'viewer' check (role in ('admin', 'viewer', 'member')),
  full_name text,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  external_id text,
  source text default 'csv' check (source in ('shopify', 'amazon', 'csv')),
  customer_email text,
  customer_name text,
  total_price numeric(10,2) not null default 0,
  status text default 'paid' check (status in ('paid', 'pending', 'refunded', 'cancelled')),
  is_subscription boolean default false,
  created_at timestamptz not null default now(),
  synced_at timestamptz default now(),
  unique(org_id, external_id)
);

create table ad_spend (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  platform text not null check (platform in ('meta', 'google', 'tiktok')),
  campaign_name text,
  spend numeric(10,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  date date not null,
  synced_at timestamptz default now()
);

create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  org_id uuid references organizations(id),
  org_name text,
  question text not null,
  answer text not null,
  type text default 'chat' check (type in ('chat', 'insights')),
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  order_external_id text,
  product_title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1,
  price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- Indexes for performance
-- ============================================
create index orders_org_created on orders(org_id, created_at desc);
create index orders_org_external on orders(org_id, external_id) where external_id is not null;
create index ad_spend_org_date on ad_spend(org_id, date desc);

-- ============================================
-- Row-Level Security
-- ============================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table ad_spend enable row level security;

create policy "org members only" on organizations
  for all using (id = (select org_id from profiles where id = auth.uid()));

create policy "own profile only" on profiles
  for all using (id = auth.uid());

create policy "org orders only" on orders
  for all using (org_id = (select org_id from profiles where id = auth.uid()));

create policy "org ad spend only" on ad_spend
  for all using (org_id = (select org_id from profiles where id = auth.uid()));

-- ============================================
-- Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
