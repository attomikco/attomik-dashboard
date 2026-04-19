-- Allow 'walmart' as a source in orders and sync_timestamps
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK (source IN ('shopify', 'amazon', 'walmart', 'csv'));

ALTER TABLE sync_timestamps DROP CONSTRAINT IF EXISTS sync_timestamps_source_check;
ALTER TABLE sync_timestamps ADD CONSTRAINT sync_timestamps_source_check CHECK (source IN ('shopify', 'amazon', 'walmart', 'meta'));

-- Optional Walmart Seller ID for future API integration
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS walmart_seller_id text;
