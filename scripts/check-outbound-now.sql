-- ============================================
-- 快速诊断：检查出库数据
-- ============================================

-- 1. 检查 delivery_appointments 表中有没有预约
SELECT 
  '1. delivery_appointments 表统计' as check_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN confirmed_start IS NOT NULL THEN 1 END) as has_confirmed_start,
  COUNT(CASE WHEN rejected = false OR rejected IS NULL THEN 1 END) as not_rejected_count
FROM oms.delivery_appointments;

-- 2. 查看最近创建的预约
SELECT 
  '2. 最近的预约（最新10条）' as check_name,
  appointment_id,
  order_id,
  confirmed_start,
  requested_start,
  rejected,
  created_at
FROM oms.delivery_appointments
ORDER BY created_at DESC
LIMIT 10;

-- 3. 检查 appointment_detail_lines 表
SELECT 
  '3. appointment_detail_lines 表统计' as check_name,
  COUNT(*) as total_lines,
  SUM(estimated_pallets) as total_pallets
FROM oms.appointment_detail_lines;

-- 4. 检查最近的预约明细
SELECT 
  '4. 最近的预约明细' as check_name,
  adl.id,
  adl.appointment_id,
  adl.order_detail_id,
  adl.estimated_pallets,
  adl.created_at
FROM oms.appointment_detail_lines adl
ORDER BY adl.created_at DESC
LIMIT 10;

-- 5. 关键检查：关联查询（模拟实际查询）
SELECT 
  '5. 完整关联查询（最近30天）' as check_name,
  da.appointment_id,
  da.confirmed_start,
  da.requested_start,
  da.rejected,
  adl.estimated_pallets,
  od.delivery_location,
  od.delivery_nature
FROM oms.delivery_appointments da
LEFT JOIN oms.appointment_detail_lines adl ON adl.appointment_id = da.appointment_id
LEFT JOIN order_detail od ON adl.order_detail_id = od.id
WHERE da.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY da.created_at DESC
LIMIT 20;

-- 6. 检查 confirmed_start 在指定日期范围内的数据
SELECT 
  '6. 日期范围内的预约（2025-12-12 到 2025-12-26）' as check_name,
  da.appointment_id,
  da.confirmed_start,
  da.rejected,
  COUNT(adl.id) as detail_count,
  SUM(adl.estimated_pallets) as total_pallets
FROM oms.delivery_appointments da
LEFT JOIN oms.appointment_detail_lines adl ON adl.appointment_id = da.appointment_id
WHERE da.confirmed_start >= '2025-12-12T00:00:00Z'::TIMESTAMPTZ
  AND da.confirmed_start < '2025-12-27T00:00:00Z'::TIMESTAMPTZ
GROUP BY da.appointment_id, da.confirmed_start, da.rejected
ORDER BY da.confirmed_start;

-- 7. 检查有 confirmed_start 且未被拒收的预约
SELECT 
  '7. 有效的预约（有送货时间且未拒收）' as check_name,
  da.appointment_id,
  da.order_id,
  da.confirmed_start,
  da.requested_start,
  da.rejected
FROM oms.delivery_appointments da
WHERE da.confirmed_start IS NOT NULL
  AND (da.rejected = false OR da.rejected IS NULL)
ORDER BY da.confirmed_start DESC
LIMIT 10;

-- 8. 如果有数据，查看实际的出库汇总（模拟查询）
SELECT 
  '8. 实际出库汇总（如果有数据）' as check_name,
  da.confirmed_start::DATE as date,
  od.delivery_location,
  od.delivery_nature,
  SUM(adl.estimated_pallets) as total_pallets,
  COUNT(*) as line_count
FROM oms.delivery_appointments da
INNER JOIN oms.appointment_detail_lines adl ON adl.appointment_id = da.appointment_id
INNER JOIN order_detail od ON adl.order_detail_id = od.id
WHERE da.confirmed_start >= '2025-12-12T00:00:00Z'::TIMESTAMPTZ
  AND da.confirmed_start < '2025-12-27T00:00:00Z'::TIMESTAMPTZ
  AND da.confirmed_start IS NOT NULL
  AND (da.rejected = false OR da.rejected IS NULL)
GROUP BY date, od.delivery_location, od.delivery_nature
ORDER BY date;

-- ============================================
-- 分析结果
-- ============================================
-- 
-- 如果查询 1 显示 has_confirmed_start = 0：
--   → 没有 confirmed_start 不为空的预约
--   → 所有预约都没有确认送货时间
--
-- 如果查询 3 显示 total_lines = 0：
--   → appointment_detail_lines 表是空的
--   → 这是最可能的原因！
--
-- 如果查询 5 显示数据但 adl.id 为 NULL：
--   → 预约存在但没有明细
--   → 需要添加预约明细
--
-- 如果查询 7 有数据但查询 8 没有数据：
--   → confirmed_start 可能不在日期范围内
--   → 检查 confirmed_start 的值
--
-- 如果查询 1 显示 not_rejected_count 很少：
--   → 大部分预约被标记为拒收（rejected = true）
--   → 检查 rejected 字段
--
-- ============================================
