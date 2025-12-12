-- ============================================
-- 库存预测性能优化：创建关键索引
-- ============================================
-- 
-- 目的：优化库存预测计算的查询性能
-- 
-- 索引说明：
-- 1. inbound_receipt.planned_unload_at - 用于查询指定日期的计划入库
-- 2. delivery_appointments.confirmed_start - 用于查询指定日期的计划出库
-- 3. order_detail.delivery_location - 用于按仓点筛选订单明细
-- 4. order_detail.delivery_nature - 用于按送仓性质筛选（私仓/扣货）
-- 5. inventory_lots.received_date - 用于计算历史库存（找出指定日期之前已收货的库存）
-- 
-- ============================================

-- 1. 入库日期索引（inbound_receipt.planned_unload_at）
-- 用途：查询指定日期的计划入库订单
-- 前端字段：入库管理 -> 预计拆柜日期
CREATE INDEX IF NOT EXISTS idx_inbound_receipt_planned_unload_at 
ON wms.inbound_receipt(planned_unload_at) 
WHERE status != 'cancelled';

-- 2. 预约确认时间索引（delivery_appointments.confirmed_start）
-- 用途：查询指定日期的计划出库预约
-- 前端字段：预约管理 -> 确认开始时间
CREATE INDEX IF NOT EXISTS idx_delivery_appointments_confirmed_start 
ON oms.delivery_appointments(confirmed_start) 
WHERE status = 'confirmed';

-- 3. 订单明细仓点索引（order_detail.delivery_location）
-- 用途：按仓点筛选订单明细（用于计算各仓点的入库/出库）
-- 前端字段：订单明细 -> 仓点
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_location 
ON order_detail(delivery_location) 
WHERE delivery_location IS NOT NULL AND delivery_location != '';

-- 4. 订单明细送仓性质索引（order_detail.delivery_nature）
-- 用途：按送仓性质筛选订单明细（用于计算私仓/扣货的入库/出库）
-- 前端字段：订单明细 -> 送仓性质
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_nature 
ON order_detail(delivery_nature) 
WHERE delivery_nature IS NOT NULL;

-- 5. 库存接收日期索引（inventory_lots.received_date）
-- 用途：计算历史库存时，找出所有在指定日期之前已收货的库存记录
-- 前端字段：库存管理 -> 收货日期
-- 
-- 为什么需要这个索引？
-- 在 calculateHistoricalInventory() 函数中，需要查询：
--   WHERE il.received_date < '2025-12-11'::DATE
--   或者 il.received_date IS NULL
-- 
-- 这个查询会扫描所有库存记录，如果没有索引，会非常慢
-- 特别是当库存记录数量很大时（比如几万条记录）
CREATE INDEX IF NOT EXISTS idx_inventory_lots_received_date_status 
ON wms.inventory_lots(received_date, status) 
WHERE status = 'available';

-- 6. 复合索引：订单明细（仓点 + 送仓性质）
-- 用途：同时按仓点和送仓性质筛选，提升查询效率
CREATE INDEX IF NOT EXISTS idx_order_detail_location_nature 
ON order_detail(delivery_location, delivery_nature) 
WHERE delivery_location IS NOT NULL 
  AND delivery_location != '' 
  AND delivery_nature IS NOT NULL;

-- ============================================
-- 索引创建完成
-- ============================================
-- 
-- 验证索引是否创建成功：
-- SELECT indexname, tablename, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname IN ('wms', 'oms', 'public')
--   AND indexname LIKE 'idx_%forecast%' 
--    OR indexname LIKE 'idx_inbound_receipt_planned%'
--    OR indexname LIKE 'idx_delivery_appointments_confirmed%'
--    OR indexname LIKE 'idx_order_detail_delivery%'
--    OR indexname LIKE 'idx_inventory_lots_received%';
-- 
-- ============================================

