-- 预约明细表增加拒收板数字段，有效占用 = estimated_pallets - rejected_pallets
ALTER TABLE "oms"."appointment_detail_lines"
ADD COLUMN IF NOT EXISTS "rejected_pallets" INTEGER DEFAULT 0;

-- 确保现有行为：已有数据默认为 0
UPDATE "oms"."appointment_detail_lines"
SET "rejected_pallets" = 0
WHERE "rejected_pallets" IS NULL;

-- 若需要非空约束（可选，根据业务）
-- ALTER TABLE "oms"."appointment_detail_lines" ALTER COLUMN "rejected_pallets" SET NOT NULL;
