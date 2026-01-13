-- Migration: Add foreign key constraint for order_detail.delivery_location_id
-- This migration converts delivery_location from String to BigInt (delivery_location_id)
-- and adds a foreign key constraint to locations.location_id

BEGIN;

-- Step 1: Add new column delivery_location_id
ALTER TABLE public.order_detail 
ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;

-- Step 2: Convert existing delivery_location string values to location_id
-- If delivery_location is a numeric string, convert it directly
-- If delivery_location is a location_code, look up the corresponding location_id
UPDATE public.order_detail od
SET delivery_location_id = CASE
  -- If delivery_location is a pure numeric string, convert directly
  WHEN od.delivery_location ~ '^[0-9]+$' THEN 
    CAST(od.delivery_location AS BIGINT)
  -- If delivery_location is a location_code, find the location_id
  WHEN od.delivery_location IS NOT NULL THEN
    (SELECT location_id FROM public.locations WHERE location_code = od.delivery_location LIMIT 1)
  ELSE NULL
END
WHERE od.delivery_location IS NOT NULL;

-- Step 3: Drop the old delivery_location column
ALTER TABLE public.order_detail 
DROP COLUMN IF EXISTS delivery_location;

-- Step 4: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_detail_delivery_location_id_fk'
  ) THEN
    ALTER TABLE public.order_detail
    ADD CONSTRAINT order_detail_delivery_location_id_fk
    FOREIGN KEY (delivery_location_id)
    REFERENCES public.locations(location_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 5: Update index (drop old index, add new index)
DROP INDEX IF EXISTS public.idx_order_detail_delivery_location;
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_location_id ON public.order_detail(delivery_location_id);

COMMIT;
