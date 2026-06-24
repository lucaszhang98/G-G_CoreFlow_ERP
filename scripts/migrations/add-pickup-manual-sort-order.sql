-- 提柜管理：手动拖拽行顺序（tms schema）
ALTER TABLE tms.pickup_management
  ADD COLUMN IF NOT EXISTS manual_sort_order INTEGER;

CREATE INDEX IF NOT EXISTS pickup_management_manual_sort_order_idx
  ON tms.pickup_management (manual_sort_order);
