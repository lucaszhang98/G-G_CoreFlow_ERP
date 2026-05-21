-- 订单明细：私仓信息（仅送仓性质=私仓时有值，创建时自动生成，全局唯一）
ALTER TABLE "public"."order_detail"
ADD COLUMN "private_warehouse_info" VARCHAR(20);

CREATE UNIQUE INDEX "order_detail_private_warehouse_info_key"
ON "public"."order_detail"("private_warehouse_info")
WHERE "private_warehouse_info" IS NOT NULL;
