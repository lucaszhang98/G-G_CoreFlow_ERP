-- Migration: Add trailer_code field to wms.outbound_shipments
-- This field stores the trailer code as a text string (editable)

BEGIN;

-- Step 1: Add trailer_code column
ALTER TABLE wms.outbound_shipments
ADD COLUMN IF NOT EXISTS trailer_code VARCHAR(100);

COMMIT;

