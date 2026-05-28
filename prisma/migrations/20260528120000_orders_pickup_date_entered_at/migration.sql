-- 记录提柜日期从空首次录入的时间（用于预约明细「预计窗口期」仅录入当天标红）
ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "pickup_date_entered_at" TIMESTAMPTZ(6);
