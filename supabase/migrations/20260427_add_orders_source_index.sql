-- Performance: covering index for the source-filtered date-range queries used
-- by /api/overview (POST), the analytics page, and the weekly email worker.
-- Each of those does:
--   .eq('org_id', X).gte('created_at', A).lte('created_at', B).eq('source', S)
-- Without this index, those queries fall back to a partial scan + filter on
-- source. The existing orders_org_email_created index doesn't cover source.
--
-- CONCURRENTLY so the build never holds a write lock; must run outside a txn.
create index concurrently if not exists orders_org_source_created
  on orders(org_id, source, created_at);
