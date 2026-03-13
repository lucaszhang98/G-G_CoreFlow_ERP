-- AlterTable
ALTER TABLE "wms"."inbound_receipt" ADD COLUMN IF NOT EXISTS "arrived_at_warehouse" BOOLEAN DEFAULT false;
