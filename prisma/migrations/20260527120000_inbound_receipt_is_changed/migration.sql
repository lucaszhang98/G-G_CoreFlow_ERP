-- 入库管理「已变更」标记：柜号橙色展示，全员可见
ALTER TABLE "wms"."inbound_receipt" ADD COLUMN IF NOT EXISTS "is_changed" BOOLEAN NOT NULL DEFAULT false;
