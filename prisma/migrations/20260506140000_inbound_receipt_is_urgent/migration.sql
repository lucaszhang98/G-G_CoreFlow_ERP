-- 入库管理「加急」标记：全员可见，默认否
ALTER TABLE "wms"."inbound_receipt" ADD COLUMN "is_urgent" BOOLEAN NOT NULL DEFAULT false;
