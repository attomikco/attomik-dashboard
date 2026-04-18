-- Weekly performance email: per-org enable toggle
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS weekly_email_enabled boolean NOT NULL DEFAULT false;
