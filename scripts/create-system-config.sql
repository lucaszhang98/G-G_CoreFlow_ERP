-- ============================================
-- 系统配置表：业务日期管理
-- ============================================
-- 用途：存储系统当前业务日期，避免读取外部时间
-- 原则：所有业务逻辑都从这张表获取"今天"的日期
-- ============================================

-- 创建系统配置表（如果不存在）
CREATE TABLE IF NOT EXISTS public.system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value VARCHAR(500) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by BIGINT
);

-- 插入或更新当前业务日期
-- 注意：初始值需要手动设置，或者通过定时任务每天更新
INSERT INTO public.system_config (config_key, config_value, description)
VALUES ('current_business_date', CURRENT_DATE::TEXT, '当前业务日期（YYYY-MM-DD），由定时任务每天更新')
ON CONFLICT (config_key) 
DO UPDATE SET 
  config_value = CURRENT_DATE::TEXT,
  updated_at = NOW();

-- 创建函数：获取当前业务日期
CREATE OR REPLACE FUNCTION public.get_current_business_date()
RETURNS DATE AS $$
DECLARE
  business_date DATE;
BEGIN
  SELECT config_value::DATE INTO business_date
  FROM public.system_config
  WHERE config_key = 'current_business_date';
  
  -- 如果配置表中没有数据，返回数据库当前日期（作为后备）
  IF business_date IS NULL THEN
    RETURN CURRENT_DATE;
  END IF;
  
  RETURN business_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- 创建函数：更新业务日期（通常由定时任务调用）
CREATE OR REPLACE FUNCTION public.update_business_date(new_date DATE DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
  target_date DATE;
BEGIN
  -- 如果没有提供新日期，使用数据库当前日期
  IF new_date IS NULL THEN
    target_date := CURRENT_DATE;
  ELSE
    target_date := new_date;
  END IF;
  
  -- 更新配置表
  INSERT INTO public.system_config (config_key, config_value, description)
  VALUES ('current_business_date', target_date::TEXT, '当前业务日期（YYYY-MM-DD），由定时任务每天更新')
  ON CONFLICT (config_key) 
  DO UPDATE SET 
    config_value = target_date::TEXT,
    updated_at = NOW();
  
  RETURN target_date;
END;
$$ LANGUAGE plpgsql;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(config_key);

-- 添加注释
COMMENT ON TABLE public.system_config IS '系统配置表，存储系统级别的配置信息，包括当前业务日期';
COMMENT ON COLUMN public.system_config.config_key IS '配置键（唯一标识）';
COMMENT ON COLUMN public.system_config.config_value IS '配置值';
COMMENT ON COLUMN public.system_config.updated_at IS '最后更新时间';
COMMENT ON FUNCTION public.get_current_business_date() IS '获取当前业务日期，所有业务逻辑应使用此函数而不是 CURRENT_DATE';
COMMENT ON FUNCTION public.update_business_date(DATE) IS '更新业务日期，通常由定时任务每天调用';

