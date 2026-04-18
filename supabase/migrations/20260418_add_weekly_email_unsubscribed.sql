-- Per-recipient unsubscribe list for the weekly performance email
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS weekly_email_unsubscribed text[] NOT NULL DEFAULT '{}';
