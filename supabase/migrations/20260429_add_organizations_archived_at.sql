-- Soft-archive flag for clients we're no longer working with. NULL = active.
-- Archived orgs are hidden from the overview, sidebar, projects page, and the
-- weekly email blast, but their historical data (orders, ad spend, insights,
-- chat logs) is preserved.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_archived_at_idx
  ON organizations(archived_at) WHERE archived_at IS NOT NULL;
