-- 从 order_detail 表中删除 unbooked_pallet_count 字段
-- 因为未入库时使用 remaining_pallets 字段即可

-- 检查字段是否存在
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'order_detail' 
            AND column_name = 'unbooked_pallet_count'
        ) THEN '字段存在，需要删除'
        ELSE '字段不存在，无需操作'
    END AS status;

-- 如果字段存在，执行以下 SQL 删除字段
-- ALTER TABLE public.order_detail 
-- DROP COLUMN IF EXISTS unbooked_pallet_count;

