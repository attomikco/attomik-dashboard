-- Allow 'amazon' as a platform in ad_spend
ALTER TABLE ad_spend DROP CONSTRAINT IF EXISTS ad_spend_platform_check;
ALTER TABLE ad_spend ADD CONSTRAINT ad_spend_platform_check CHECK (platform IN ('meta', 'google', 'tiktok', 'amazon'));
