ALTER TABLE orders
ADD COLUMN IF NOT EXISTS ship_date TIMESTAMPTZ;

-- Optional: backfill ship_date for existing shipped orders without a value
UPDATE orders
SET ship_date = COALESCE(ship_date, updated_at)
WHERE order_status = 'shipped' AND ship_date IS NULL;

