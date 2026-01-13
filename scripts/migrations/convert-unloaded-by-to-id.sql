-- 将 unloaded_by 从用户名字符串转换为用户ID
-- 步骤1: 添加新的临时列 unloaded_by_new (BigInt)
ALTER TABLE wms.inbound_receipt 
ADD COLUMN IF NOT EXISTS unloaded_by_new BigInt;

-- 步骤2: 根据用户名查找用户ID并更新临时列
UPDATE wms.inbound_receipt ir
SET unloaded_by_new = u.id
FROM public.users u
WHERE ir.unloaded_by IS NOT NULL 
  AND ir.unloaded_by != ''
  AND (u.username = ir.unloaded_by OR u.full_name = ir.unloaded_by)
  AND ir.unloaded_by_new IS NULL;

-- 步骤3: 删除旧的 unloaded_by 列
ALTER TABLE wms.inbound_receipt 
DROP COLUMN IF EXISTS unloaded_by;

-- 步骤4: 重命名新列为 unloaded_by
ALTER TABLE wms.inbound_receipt 
RENAME COLUMN unloaded_by_new TO unloaded_by;

-- 步骤5: 添加外键约束
ALTER TABLE wms.inbound_receipt
ADD CONSTRAINT inbound_receipt_unloaded_by_fkey 
FOREIGN KEY (unloaded_by) 
REFERENCES public.users(id) 
ON DELETE NO ACTION 
ON UPDATE NO ACTION;

-- 步骤6: 添加索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_inbound_receipt_unloaded_by 
ON wms.inbound_receipt(unloaded_by);

