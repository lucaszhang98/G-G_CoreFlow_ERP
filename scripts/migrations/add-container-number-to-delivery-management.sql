-- Migration: Add container_number field to tms.delivery_management
-- This field stores the container number, which can be manually edited
-- For direct delivery (直送), it will be auto-filled from orders.order_number

BEGIN;

-- Step 1: Add container_number column
ALTER TABLE tms.delivery_management
ADD COLUMN IF NOT EXISTS container_number VARCHAR(100);

-- Step 2: For existing records with direct delivery (直送), auto-fill from orders.order_number
UPDATE tms.delivery_management dm
SET container_number = o.order_number
FROM oms.delivery_appointments da
JOIN public.orders o ON o.order_id = da.order_id
WHERE dm.appointment_id = da.appointment_id
  AND da.delivery_method = '直送'
  AND dm.container_number IS NULL;

COMMIT;

