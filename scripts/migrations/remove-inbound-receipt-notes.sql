-- Migration: Remove notes field from inbound_receipt table
-- The notes field should be stored in order_detail.notes instead
-- This migration removes the redundant notes field from inbound_receipt

BEGIN;

-- Step 1: Drop the notes column from inbound_receipt table
ALTER TABLE wms.inbound_receipt 
DROP COLUMN IF EXISTS notes;

COMMIT;

