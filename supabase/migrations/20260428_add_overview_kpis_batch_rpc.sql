-- Aggregate Overview KPI rows in Postgres instead of shipping every order and
-- ad-spend row to the Next.js server. The API validates org access before
-- calling this function with the service role.

create or replace function public.overview_kpis_batch(_ranges jsonb)
returns table (
  org_id uuid,
  revenue numeric,
  prev_revenue numeric,
  net_rev numeric,
  prev_net_rev numeric,
  orders numeric,
  prev_orders numeric,
  ad_spend numeric,
  prev_ad_spend numeric,
  shopify_rev numeric,
  amazon_rev numeric,
  walmart_rev numeric,
  shopify_orders numeric,
  prev_shopify_orders numeric
)
language sql
stable
as $$
  with req as (
    select *
    from jsonb_to_recordset(_ranges) as r(
      org_id uuid,
      start_ts timestamptz,
      end_ts timestamptz,
      prev_start_ts timestamptz,
      prev_end_ts timestamptz,
      ad_spend_start date,
      ad_spend_end date,
      ad_spend_prev_start date,
      ad_spend_prev_end date,
      amazon_start_ts timestamptz,
      amazon_end_ts timestamptz,
      amazon_prev_start_ts timestamptz,
      amazon_prev_end_ts timestamptz
    )
  ),
  flags as (
    select
      r.*,
      coalesce(o.channels, '{}'::jsonb) = '{}'::jsonb
        or coalesce(o.channels, '{}'::jsonb)->>'shopify' is distinct from 'false' as show_shopify,
      coalesce(o.channels, '{}'::jsonb) = '{}'::jsonb
        or coalesce(o.channels, '{}'::jsonb)->>'amazon' is distinct from 'false' as show_amazon,
      coalesce(o.channels, '{}'::jsonb) = '{}'::jsonb
        or coalesce(o.channels, '{}'::jsonb)->>'walmart' is distinct from 'false' as show_walmart
    from req r
    left join organizations o on o.id = r.org_id
  ),
  cur_orders as (
    select
      f.org_id,
      coalesce(sum(o.total_price) filter (where included), 0) as revenue,
      coalesce(sum(case when o.subtotal is null or o.subtotal = 0 then o.total_price else o.subtotal end) filter (where included), 0) as net_rev,
      coalesce(sum(case when o.source in ('amazon', 'walmart') then coalesce(nullif(o.units, 0), 1) else 1 end) filter (where included), 0) as orders,
      coalesce(sum(o.total_price) filter (where included and o.source = 'shopify'), 0) as shopify_rev,
      coalesce(sum(o.total_price) filter (where included and o.source = 'amazon'), 0) as amazon_rev,
      coalesce(sum(o.total_price) filter (where included and o.source = 'walmart'), 0) as walmart_rev,
      coalesce(count(*) filter (where included and o.source = 'shopify'), 0) as shopify_orders
    from flags f
    left join lateral (
      select
        o.*,
        (
          (f.show_shopify and (o.source = 'shopify' or o.source is null or o.source not in ('shopify', 'amazon', 'walmart'))) or
          (f.show_amazon and o.source = 'amazon') or
          (f.show_walmart and o.source = 'walmart')
        ) as included
      from orders o
      where o.org_id = f.org_id
        and o.status <> 'refunded'
        and (
          (o.source = 'amazon' and o.created_at >= f.amazon_start_ts and o.created_at <= f.amazon_end_ts)
          or
          (o.source is distinct from 'amazon' and o.created_at >= f.start_ts and o.created_at <= f.end_ts)
        )
    ) o on true
    group by f.org_id
  ),
  prev_orders as (
    select
      f.org_id,
      coalesce(sum(o.total_price) filter (where included), 0) as prev_revenue,
      coalesce(sum(case when o.subtotal is null or o.subtotal = 0 then o.total_price else o.subtotal end) filter (where included), 0) as prev_net_rev,
      coalesce(sum(case when o.source in ('amazon', 'walmart') then coalesce(nullif(o.units, 0), 1) else 1 end) filter (where included), 0) as prev_orders,
      coalesce(count(*) filter (where included and o.source = 'shopify'), 0) as prev_shopify_orders
    from flags f
    left join lateral (
      select
        o.*,
        (
          (f.show_shopify and (o.source = 'shopify' or o.source is null or o.source not in ('shopify', 'amazon', 'walmart'))) or
          (f.show_amazon and o.source = 'amazon') or
          (f.show_walmart and o.source = 'walmart')
        ) as included
      from orders o
      where o.org_id = f.org_id
        and o.status <> 'refunded'
        and (
          (o.source = 'amazon' and o.created_at >= f.amazon_prev_start_ts and o.created_at <= f.amazon_prev_end_ts)
          or
          (o.source is distinct from 'amazon' and o.created_at >= f.prev_start_ts and o.created_at <= f.prev_end_ts)
        )
    ) o on true
    group by f.org_id
  ),
  spend as (
    select
      f.org_id,
      coalesce(sum(a.spend), 0) as ad_spend
    from flags f
    left join ad_spend a on a.org_id = f.org_id
      and a.date >= f.ad_spend_start
      and a.date <= f.ad_spend_end
    group by f.org_id
  ),
  prev_spend as (
    select
      f.org_id,
      coalesce(sum(a.spend), 0) as prev_ad_spend
    from flags f
    left join ad_spend a on a.org_id = f.org_id
      and a.date >= f.ad_spend_prev_start
      and a.date <= f.ad_spend_prev_end
    group by f.org_id
  )
  select
    f.org_id,
    coalesce(c.revenue, 0),
    coalesce(p.prev_revenue, 0),
    coalesce(c.net_rev, 0),
    coalesce(p.prev_net_rev, 0),
    coalesce(c.orders, 0),
    coalesce(p.prev_orders, 0),
    coalesce(s.ad_spend, 0),
    coalesce(ps.prev_ad_spend, 0),
    coalesce(c.shopify_rev, 0),
    coalesce(c.amazon_rev, 0),
    coalesce(c.walmart_rev, 0),
    coalesce(c.shopify_orders, 0),
    coalesce(p.prev_shopify_orders, 0)
  from flags f
  left join cur_orders c on c.org_id = f.org_id
  left join prev_orders p on p.org_id = f.org_id
  left join spend s on s.org_id = f.org_id
  left join prev_spend ps on ps.org_id = f.org_id;
$$;
