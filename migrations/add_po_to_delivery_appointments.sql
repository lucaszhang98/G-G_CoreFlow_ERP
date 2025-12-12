-- 在delivery_appointments表中添加po字段
-- 执行日期: 2024-12-20
-- 说明: 添加PO字段，用于存储预约的PO信息

ALTER TABLE oms.delivery_appointments 
ADD COLUMN IF NOT EXISTS po VARCHAR(1000);

COMMENT ON COLUMN oms.delivery_appointments.po IS 'PO信息';
