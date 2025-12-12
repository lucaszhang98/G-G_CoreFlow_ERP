-- 在 order_detail 表中添加 unbooked_pallet_count 字段
-- 用于存储未约板数（预计板数 - 所有预约的预计板数之和，仅未入库时使用）

-- 检查字段是否已存在，如果不存在则添加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_detail' 
        AND column_name = 'unbooked_pallet_count'
    ) THEN
        ALTER TABLE public.order_detail 
        ADD COLUMN unbooked_pallet_count INTEGER;
        
        -- 初始化未约板数：对于还没有预约的明细，未约板数 = 预计板数
        UPDATE public.order_detail
        SET unbooked_pallet_count = estimated_pallets
        WHERE unbooked_pallet_count IS NULL 
        AND estimated_pallets IS NOT NULL;
        
        RAISE NOTICE '字段 unbooked_pallet_count 已成功添加到 order_detail 表';
    ELSE
        RAISE NOTICE '字段 unbooked_pallet_count 已存在，跳过添加';
    END IF;
END $$;

-- 验证字段是否已添加
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'order_detail' 
AND column_name = 'unbooked_pallet_count';

