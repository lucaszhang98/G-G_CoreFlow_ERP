-- 仓储账单明细：关联预约明细 + 入/出库时间展示
ALTER TABLE "public"."invoice_line_items"
ADD COLUMN IF NOT EXISTS "appointment_detail_line_id" BIGINT,
ADD COLUMN IF NOT EXISTS "storage_in_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "storage_out_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_line_items_appointment_detail_line_id_key"
ON "public"."invoice_line_items" ("appointment_detail_line_id");
