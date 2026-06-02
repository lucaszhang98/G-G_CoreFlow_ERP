-- 订单 FIST 是否手改（false = 跟随客户 fist 自动同步）
ALTER TABLE "public"."orders" ADD COLUMN "fist_manual" BOOLEAN NOT NULL DEFAULT false;

-- 历史订单：未手改标记的一律与客户 FIST 对齐
UPDATE "public"."orders" AS o
SET "fist" = c."fist"
FROM "public"."customers" AS c
WHERE o."customer_id" = c."id"
  AND o."fist_manual" = false;
