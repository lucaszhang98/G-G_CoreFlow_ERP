-- 迁移脚本：将 order_detail.delivery_location 从 String 改为 BigInt 外键
-- 步骤：
-- 1. 添加新字段 delivery_location_id (BigInt)
-- 2. 将现有的 delivery_location 字符串值转换为 location_id（如果可能）
-- 3. 删除旧的 delivery_location 字段
-- 4. 重命名 delivery_location_id 为 delivery_location_id（保持原字段名）
-- 5. 添加外键约束

BEGIN;

-- 步骤1: 添加新字段 delivery_location_id
ALTER TABLE public.order_detail 
ADD COLUMN delivery_location_id BIGINT;

-- 步骤2: 将现有的 delivery_location 字符串值转换为 location_id
-- 如果 delivery_location 是纯数字字符串，尝试转换为 location_id
-- 如果 delivery_location 是 location_code，通过 locations 表查找对应的 location_id
UPDATE public.order_detail od
SET delivery_location_id = CASE
  -- 如果 delivery_location 是纯数字字符串，直接转换
  WHEN od.delivery_location ~ '^[0-9]+$' THEN 
    CAST(od.delivery_location AS BIGINT)
  -- 如果 delivery_location 是 location_code，通过 locations 表查找
  WHEN od.delivery_location IS NOT NULL THEN
    (SELECT location_id FROM public.locations WHERE location_code = od.delivery_location LIMIT 1)
  ELSE NULL
END
WHERE od.delivery_location IS NOT NULL;

-- 步骤3: 删除旧的 delivery_location 字段
ALTER TABLE public.order_detail 
DROP COLUMN delivery_location;

-- 步骤4: 添加外键约束
ALTER TABLE public.order_detail
ADD CONSTRAINT order_detail_delivery_location_id_fk
FOREIGN KEY (delivery_location_id)
REFERENCES public.locations(location_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- 步骤5: 更新索引（删除旧索引，添加新索引）
DROP INDEX IF EXISTS public.idx_order_detail_delivery_location;
CREATE INDEX idx_order_detail_delivery_location_id ON public.order_detail(delivery_location_id);

COMMIT;

