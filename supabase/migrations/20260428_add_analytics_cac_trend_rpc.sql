-- Performance: aggregate the analytics CAC trend in Postgres instead of
-- returning years of order rows to the dashboard/API server.
--
-- The analytics page shows the last six order-bearing months at or before the
-- selected range end, then filters out months with zero spend. This mirrors the
-- previous client-side monthMap logic.
create or replace function public.analytics_cac_trend_v1(
  p_org_id uuid,
  p_range_end date,
  p_tz text default 'UTC'
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with order_months as (
    select
      to_char(created_at at time zone coalesce(nullif(p_tz, ''), 'UTC'), 'YYYY-MM') as month_key,
      sum(
        case
          when source in ('amazon', 'walmart') then greatest(coalesce(units, 1), 1)
          else 1
        end
      )::numeric as orders
    from orders
    where org_id = p_org_id
      and created_at >= timestamp with time zone '2020-01-01 00:00:00+00'
      and created_at <= ((p_range_end + 1)::timestamp at time zone 'UTC' - interval '1 millisecond')
    group by 1
  ),
  spend_months as (
    select
      to_char(date, 'YYYY-MM') as month_key,
      sum(spend)::numeric as spend
    from ad_spend
    where org_id = p_org_id
      and date >= date '2020-01-01'
      and date <= p_range_end
    group by 1
  ),
  last_order_months as (
    select
      o.month_key,
      o.orders,
      coalesce(s.spend, 0)::numeric as spend
    from order_months o
    left join spend_months s on s.month_key = o.month_key
    where o.month_key <= to_char(p_range_end, 'YYYY-MM')
    order by o.month_key desc
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', month_key,
        'orders', orders,
        'spend', spend
      )
      order by month_key
    ) filter (where spend > 0),
    '[]'::jsonb
  )
  from last_order_months;
$$;

grant execute on function public.analytics_cac_trend_v1(uuid, date, text) to authenticated;
