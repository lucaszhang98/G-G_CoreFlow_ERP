-- 创建周度库存预测表
-- 用于存储未来8周的周度预测数据

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.inventory_forecast_weekly (
  forecast_id BIGSERIAL PRIMARY KEY,
  location_id BIGINT,
  location_group VARCHAR(50) NOT NULL,
  location_name VARCHAR(200) NOT NULL,
  week_start_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  planned_inbound INTEGER DEFAULT 0,
  planned_outbound INTEGER DEFAULT 0,
  remaining_pallets INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_version INTEGER DEFAULT 1,
  CONSTRAINT unique_location_week UNIQUE(location_id, location_group, week_start_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_forecast_weekly_location_week ON analytics.inventory_forecast_weekly(location_id, location_group, week_start_date);
CREATE INDEX IF NOT EXISTS idx_forecast_weekly_week_start ON analytics.inventory_forecast_weekly(week_start_date);
CREATE INDEX IF NOT EXISTS idx_forecast_weekly_location_group ON analytics.inventory_forecast_weekly(location_group, week_start_date);
CREATE INDEX IF NOT EXISTS idx_forecast_weekly_calculated_at ON analytics.inventory_forecast_weekly(calculated_at);

