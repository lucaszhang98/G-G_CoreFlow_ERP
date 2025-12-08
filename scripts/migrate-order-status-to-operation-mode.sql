-- 迁移脚本：将 orders.status 中的 'unload' 和 'direct_delivery' 迁移到 operation_mode
-- 执行前请备份数据库！

-- 步骤1：将 status 中的 'unload' 和 'direct_delivery' 迁移到 operation_mode
UPDATE public.orders
SET operation_mode = status
WHERE status IN ('unload', 'direct_delivery')
  AND (operation_mode IS NULL OR operation_mode = '');

-- 步骤2：将 status 中的 'unload' 和 'direct_delivery' 改为 'pending'（如果原来是这些值）
-- 注意：这里假设原来 status 是 'unload' 或 'direct_delivery' 的订单，应该改为 'pending'
UPDATE public.orders
SET status = 'pending'
WHERE status IN ('unload', 'direct_delivery');

-- 验证：检查迁移结果
-- SELECT 
--   status,
--   operation_mode,
--   COUNT(*) as count
-- FROM public.orders
-- GROUP BY status, operation_mode
-- ORDER BY status, operation_mode;

