-- 预约明细：预计窗口期（可人工锁定，锁定后不再随提柜日期自动更新）
ALTER TABLE "oms"."appointment_detail_lines"
  ADD COLUMN IF NOT EXISTS "estimated_window_period" DATE,
  ADD COLUMN IF NOT EXISTS "estimated_window_period_locked" BOOLEAN NOT NULL DEFAULT false;

-- 初始化：有提柜日期的按日历日 +3 天
UPDATE "oms"."appointment_detail_lines" adl
SET "estimated_window_period" = ((o."pickup_date" AT TIME ZONE 'UTC')::date + 3)
FROM "public"."order_detail" od
JOIN "public"."orders" o ON o."order_id" = od."order_id"
WHERE adl."order_detail_id" = od."id"
  AND o."pickup_date" IS NOT NULL
  AND adl."estimated_window_period_locked" = false
  AND adl."estimated_window_period" IS NULL;
