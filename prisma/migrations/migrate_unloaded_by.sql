-- 迁移脚本：将 unloaded_by 从 VARCHAR 改为 BIGINT 并添加外键约束
-- 执行前请备份数据库！

-- 步骤1: 检查当前字段类型（可选，用于验证）
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'wms' AND table_name = 'inbound_receipt' AND column_name = 'unloaded_by';

-- 步骤2: 如果 unloaded_by 字段中有非数字数据，需要先清理
-- 注意：如果字段中有字符串值（如用户名），需要先转换为用户ID
-- UPDATE wms.inbound_receipt SET unloaded_by = NULL WHERE unloaded_by IS NOT NULL AND unloaded_by !~ '^[0-9]+$';

-- 步骤3: 删除旧的外键约束（如果存在）
-- ALTER TABLE wms.inbound_receipt DROP CONSTRAINT IF EXISTS inbound_receipt_unloaded_by_fkey;

-- 步骤4: 修改字段类型（如果字段中有数据，需要先清空或转换）
-- 方案A: 如果字段为空或可以清空
ALTER TABLE wms.inbound_receipt 
  ALTER COLUMN unloaded_by TYPE BIGINT USING NULL;

-- 方案B: 如果字段中有数字字符串，可以转换
-- ALTER TABLE wms.inbound_receipt 
--   ALTER COLUMN unloaded_by TYPE BIGINT USING unloaded_by::BIGINT;

-- 步骤5: 添加外键约束
ALTER TABLE wms.inbound_receipt
  ADD CONSTRAINT inbound_receipt_unloaded_by_fkey
  FOREIGN KEY (unloaded_by)
  REFERENCES public.users (id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

-- 步骤6: 验证迁移结果
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'wms' AND table_name = 'inbound_receipt' AND column_name = 'unloaded_by';



