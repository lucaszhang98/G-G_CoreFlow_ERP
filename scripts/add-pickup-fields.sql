-- 为提柜管理表添加三个新字段：码头位置、船司、司机

-- 1. 添加码头位置字段（文本，最长10字符）
ALTER TABLE tms.pickup_management 
ADD COLUMN IF NOT EXISTS port_location VARCHAR(10);

-- 2. 添加船司字段（文本，最长10字符）
ALTER TABLE tms.pickup_management 
ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(10);

-- 3. 添加司机ID字段（关联到 drivers 表）
ALTER TABLE tms.pickup_management 
ADD COLUMN IF NOT EXISTS driver_id BIGINT;

-- 4. 添加外键约束（司机）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pickup_management_driver_id_fkey'
    ) THEN
        ALTER TABLE tms.pickup_management
        ADD CONSTRAINT pickup_management_driver_id_fkey
        FOREIGN KEY (driver_id) 
        REFERENCES public.drivers(driver_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_pickup_management_driver_id ON tms.pickup_management(driver_id);

-- 6. 添加注释
COMMENT ON COLUMN tms.pickup_management.port_location IS '码头位置（文本）';
COMMENT ON COLUMN tms.pickup_management.shipping_line IS '船司（文本）';
COMMENT ON COLUMN tms.pickup_management.driver_id IS '司机ID（关联drivers表）';

