-- 订单明细手改剩余/未约后锁定，重算跳过
ALTER TABLE "wms"."inventory_lots"
ADD COLUMN IF NOT EXISTS "pallet_counts_verified" BOOLEAN NOT NULL DEFAULT false;
