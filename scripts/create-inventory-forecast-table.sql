-- ============================================
-- 创建库存预测报表表结构
-- Schema: analytics
-- Table: inventory_forecast_daily
-- ============================================

-- 1. 创建 analytics schema（如果不存在）
CREATE SCHEMA IF NOT EXISTS analytics;

-- 2. 创建库存预测日报表（15天预测）
CREATE TABLE IF NOT EXISTS analytics.inventory_forecast_daily (
  -- 主键和标识
  forecast_id BIGSERIAL PRIMARY KEY,
  
  -- 仓点标识（用于区分不同的行）
  location_id BIGINT,                    -- 仓点ID（亚马逊/FEDEX/UPS用，私仓/扣货为NULL）
  location_group VARCHAR(50) NOT NULL,    -- 仓点分组：'amazon', 'fedex', 'ups', 'private_warehouse', 'hold'
  location_name VARCHAR(200) NOT NULL,    -- 仓点显示名称（前端表格第一列）
  
  -- 时间维度
  forecast_date DATE NOT NULL,          -- 预测日期（绝对日期）
  
  -- 数据列（对应Excel表格的列）
  historical_inventory INTEGER DEFAULT 0, -- 历史库存板数（截至该日期之前）
  planned_inbound INTEGER DEFAULT 0,     -- 预计入库板数（planned_unload_at = 该日期）
  planned_outbound INTEGER DEFAULT 0,    -- 预计出库板数（confirmed_start = 该日期）
  forecast_inventory INTEGER DEFAULT 0,  -- 预计库存板数（计算列）
  
  -- 元数据和审计
  calculated_at TIMESTAMPTZ DEFAULT NOW(), -- 计算时间
  calculation_version INTEGER DEFAULT 1,   -- 计算版本
  
  -- 唯一约束：同一仓点、同一天只能有一条记录
  CONSTRAINT unique_location_date 
    UNIQUE(location_id, location_group, forecast_date)
);

-- 3. 创建索引（提升查询性能）
-- 索引1：按仓点和日期查询（最常用）
CREATE INDEX IF NOT EXISTS idx_forecast_location_date 
  ON analytics.inventory_forecast_daily(location_id, location_group, forecast_date);

-- 索引2：按日期查询（查询某一天所有仓点的数据）
CREATE INDEX IF NOT EXISTS idx_forecast_date 
  ON analytics.inventory_forecast_daily(forecast_date);

-- 索引3：按仓点分组查询（查询某个仓点所有日期的数据）
CREATE INDEX IF NOT EXISTS idx_forecast_location_group 
  ON analytics.inventory_forecast_daily(location_group, forecast_date);

-- 索引4：按计算时间查询（用于数据追溯）
CREATE INDEX IF NOT EXISTS idx_forecast_calculated_at 
  ON analytics.inventory_forecast_daily(calculated_at);

-- 4. 添加注释（便于理解）
COMMENT ON TABLE analytics.inventory_forecast_daily IS '库存预测日报表（15天预测）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.location_id IS '仓点ID（亚马逊/FEDEX/UPS用，私仓/扣货为NULL）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.location_group IS '仓点分组：amazon/fedex/ups/private_warehouse/hold';
COMMENT ON COLUMN analytics.inventory_forecast_daily.location_name IS '仓点显示名称（前端表格第一列）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.forecast_date IS '预测日期（绝对日期）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.historical_inventory IS '历史库存板数（截至该日期之前）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.planned_inbound IS '预计入库板数（planned_unload_at = 该日期）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.planned_outbound IS '预计出库板数（confirmed_start = 该日期）';
COMMENT ON COLUMN analytics.inventory_forecast_daily.forecast_inventory IS '预计库存板数（计算列）';

