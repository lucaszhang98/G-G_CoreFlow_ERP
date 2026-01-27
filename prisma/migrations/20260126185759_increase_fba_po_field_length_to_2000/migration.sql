-- 修改 delivery_appointments 表的 po 字段长度从 1000 到 2000
ALTER TABLE "oms"."delivery_appointments" 
ALTER COLUMN "po" TYPE VARCHAR(2000);

-- 修改 order_detail 表的 fba 字段长度从 1000 到 2000
ALTER TABLE "public"."order_detail" 
ALTER COLUMN "fba" TYPE VARCHAR(2000);

-- 修改 order_detail 表的 po 字段长度从 1000 到 2000
ALTER TABLE "public"."order_detail" 
ALTER COLUMN "po" TYPE VARCHAR(2000);

-- 修改 order_detail_item 表的 fba 字段长度从 100 到 2000
ALTER TABLE "public"."order_detail_item" 
ALTER COLUMN "fba" TYPE VARCHAR(2000);
