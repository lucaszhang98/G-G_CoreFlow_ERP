-- 客户 / 订单 FIST 标记（boolean，默认 false）
ALTER TABLE "public"."customers" ADD COLUMN "fist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."orders" ADD COLUMN "fist" BOOLEAN NOT NULL DEFAULT false;
