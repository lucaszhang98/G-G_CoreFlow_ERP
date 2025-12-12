-- ============================================
-- 出库数据诊断 SQL
-- ============================================
-- 用于排查为什么库存预测中没有出库记录
-- ============================================

-- 1. 检查 delivery_appointments 表中是否有确认的预约
SELECT 
  COUNT(*) as total_appointments,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_appointments,
  MIN(confirmed_start) as earliest_confirmed,
  MAX(confirmed_start) as latest_confirmed
FROM oms.delivery_appointments;

-- 2. 查看最近的确认预约（包括字段详情）
SELECT 
  appointment_id,
  order_id,
  location_id,
  status,
  confirmed_start,
  confirmed_end,
  created_at
FROM oms.delivery_appointments
WHERE status = 'confirmed'
ORDER BY confirmed_start DESC
LIMIT 10;

-- 3. 检查 appointment_detail_lines 表中是否有数据
SELECT 
  COUNT(*) as total_lines,
  SUM(estimated_pallets) as total_estimated_pallets,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM oms.appointment_detail_lines;

-- 4. 查看最近的预约明细
SELECT 
  adl.id,
  adl.appointment_id,
  adl.order_detail_id,
  adl.estimated_pallets,
  da.confirmed_start,
  da.status,
  od.delivery_location,
  od.delivery_nature
FROM oms.appointment_detail_lines adl
INNER JOIN oms.delivery_appointments da ON adl.appointment_id = da.appointment_id
INNER JOIN order_detail od ON adl.order_detail_id = od.id
ORDER BY da.confirmed_start DESC
LIMIT 10;

-- 5. 检查是否有符合条件的出库数据（最近30天）
SELECT 
  da.confirmed_start::DATE as date,
  od.delivery_location,
  od.delivery_nature,
  SUM(adl.estimated_pallets) as total_pallets
FROM oms.delivery_appointments da
INNER JOIN oms.appointment_detail_lines adl ON adl.appointment_id = da.appointment_id
INNER JOIN order_detail od ON adl.order_detail_id = od.id
WHERE da.confirmed_start >= CURRENT_DATE - INTERVAL '30 days'
  AND da.confirmed_start < CURRENT_DATE + INTERVAL '30 days'
  AND da.status = 'confirmed'
GROUP BY da.confirmed_start::DATE, od.delivery_location, od.delivery_nature
ORDER BY date DESC;

-- 6. 检查特定日期范围的出库数据（修改日期后执行）
-- 示例：查询 2025-01-15 到 2025-01-30 的出库数据
SELECT 
  da.confirmed_start::DATE as date,
  od.delivery_location,
  od.delivery_nature,
  SUM(adl.estimated_pallets) as total_pallets,
  COUNT(*) as line_count
FROM oms.delivery_appointments da
INNER JOIN oms.appointment_detail_lines adl ON adl.appointment_id = da.appointment_id
INNER JOIN order_detail od ON adl.order_detail_id = od.id
WHERE da.confirmed_start >= '2025-01-15T00:00:00Z'::TIMESTAMPTZ
  AND da.confirmed_start < '2025-01-31T00:00:00Z'::TIMESTAMPTZ
  AND da.status = 'confirmed'
GROUP BY da.confirmed_start::DATE, od.delivery_location, od.delivery_nature
ORDER BY date DESC;

-- 7. 检查是否有预约但没有明细的情况
SELECT 
  da.appointment_id,
  da.order_id,
  da.status,
  da.confirmed_start,
  COUNT(adl.id) as detail_count
FROM oms.delivery_appointments da
LEFT JOIN oms.appointment_detail_lines adl ON da.appointment_id = adl.appointment_id
WHERE da.status = 'confirmed'
  AND da.confirmed_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY da.appointment_id, da.order_id, da.status, da.confirmed_start
HAVING COUNT(adl.id) = 0
ORDER BY da.confirmed_start DESC;

-- 8. 检查 confirmed_start 字段是否为 NULL
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN confirmed_start IS NULL THEN 1 END) as null_confirmed_start,
  COUNT(CASE WHEN confirmed_start IS NOT NULL AND status = 'confirmed' THEN 1 END) as valid_confirmed
FROM oms.delivery_appointments;

-- ============================================
-- 诊断建议
-- ============================================
-- 
-- 如果查询 1 显示 confirmed_appointments = 0：
--   → 说明没有状态为 'confirmed' 的预约
--   → 检查预约的状态字段是否正确
--
-- 如果查询 3 显示 total_lines = 0：
--   → 说明 appointment_detail_lines 表是空的
--   → 这是出库数据缺失的主要原因
--
-- 如果查询 5 或 6 没有数据：
--   → 说明日期范围内没有符合条件的预约
--   → 检查 confirmed_start 字段的值是否正确
--
-- 如果查询 7 有结果：
--   → 说明有预约但没有明细
--   → 需要为这些预约添加明细数据
--
-- ============================================
