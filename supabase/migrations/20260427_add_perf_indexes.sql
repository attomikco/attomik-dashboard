-- Performance: covering index for returning-customer lookup on analytics page.
-- The analytics page builds a set of customer_emails that ordered before a cutoff date.
-- This index lets Postgres serve that lookup index-only, without heap fetches.
--
-- Run this as a single statement (not inside BEGIN/COMMIT) so CONCURRENTLY works
-- and the orders table is never locked during the build.
create index concurrently if not exists orders_org_email_created
  on orders(org_id, customer_email, created_at)
  where customer_email is not null;
