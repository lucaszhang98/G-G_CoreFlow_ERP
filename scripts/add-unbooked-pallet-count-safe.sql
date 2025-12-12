-- 安全地添加 unbooked_pallet_count 字段到 order_detail 表
-- 此脚本不会删除任何数据，只会添加新字段

-- 步骤 1: 检查字段是否已存在
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'order_detail' 
            AND column_name = 'unbooked_pallet_count'
        ) THEN '字段已存在'
        ELSE '字段不存在，需要添加'
    END AS status;

-- 步骤 2: 如果字段不存在，执行以下 SQL 添加字段
-- （请先执行上面的检查，确认字段不存在后再执行）

-- ALTER TABLE public.order_detail 
-- ADD COLUMN IF NOT EXISTS unbooked_pallet_count INTEGER;

-- 步骤 3: 初始化未约板数（对于还没有预约的明细，未约板数 = 预计板数）
-- UPDATE public.order_detail
-- SET unbooked_pallet_count = estimated_pallets
-- WHERE unbooked_pallet_count IS NULL 
-- AND estimated_pallets IS NOT NULL;

-- 步骤 4: 验证字段是否已添加
-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'order_detail' 
-- AND column_name = 'unbooked_pallet_count';

