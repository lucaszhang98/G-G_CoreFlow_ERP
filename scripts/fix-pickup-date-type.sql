-- 修改 pickup_date 字段类型从 DATE 改为 TIMESTAMPTZ
-- 这样才能存储完整的日期和时间信息

-- 修改 orders 表中的 pickup_date 字段类型
ALTER TABLE public.orders 
ALTER COLUMN pickup_date TYPE TIMESTAMPTZ 
USING pickup_date::TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN public.orders.pickup_date IS '提柜日期和时间（带时区）';

