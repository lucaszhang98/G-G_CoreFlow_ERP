-- ============================================
-- 设置 pg_cron 定时任务：每天自动更新业务日期
-- ============================================
-- 注意：Neon DB 需要启用 pg_cron 扩展
-- 如果无法使用 pg_cron，可以使用外部调度系统（如 cron job、Airflow 等）
-- ============================================

-- 检查 pg_cron 扩展是否可用
-- SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- 启用 pg_cron 扩展（需要超级用户权限）
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 创建定时任务：每天 00:00 UTC 更新业务日期
-- 注意：Neon DB 的时区是 UTC，所以 00:00 UTC 对应美西时间的 16:00 PST（前一天）或 17:00 PDT（前一天）
-- 如果需要美西时间 00:00 更新，需要计算 UTC 时间偏移
-- 
-- 美西时间 00:00 PST (UTC-8) = UTC 08:00
-- 美西时间 00:00 PDT (UTC-7) = UTC 07:00
-- 为了简化，我们使用 UTC 00:00，这样每天都会更新

-- 每天 00:00 UTC 执行（对应美西时间前一天的 16:00 PST 或 17:00 PDT）
-- SELECT cron.schedule(
--   'update-business-date-daily',
--   '0 0 * * *',  -- 每天 00:00 UTC
--   $$SELECT public.update_business_date()$$
-- );

-- 如果需要美西时间 00:00 更新，可以使用以下时间：
-- PST (11月-3月): UTC 08:00
-- PDT (3月-11月): UTC 07:00
-- 但这样需要根据夏令时动态调整，比较复杂

-- 查看所有定时任务
-- SELECT * FROM cron.job;

-- 删除定时任务（如果需要）
-- SELECT cron.unschedule('update-business-date-daily');

-- ============================================
-- 替代方案：使用外部调度系统
-- ============================================
-- 如果 Neon DB 不支持 pg_cron，可以使用以下方案：
-- 
-- 1. 应用层定时任务（Node.js cron job）
--    在应用服务器上运行定时任务，每天调用 API 更新业务日期
-- 
-- 2. 云服务定时任务（如 Vercel Cron Jobs）
--    使用 Vercel 的 cron jobs 功能，每天调用 API
-- 
-- 3. 外部调度系统（如 Airflow、Temporal）
--    使用专业的任务调度系统
-- 
-- 示例 API 端点：POST /api/admin/system/update-business-date
-- ============================================

