# 库存预测性能优化方案

## 📊 当前性能瓶颈分析

### 问题 1：查询次数过多
- **现状**：15 个仓点 × 15 天 × 3 个查询 = **675 次数据库查询**
- **影响**：每次计算需要执行大量 SQL，响应时间慢

### 问题 2：缺少关键索引
- `inbound_receipt.planned_unload_at` - 无索引
- `delivery_appointments.confirmed_start` - 无索引  
- `inventory_lots.received_date` - 无索引
- `order_detail.delivery_location` - 无索引
- `order_detail.delivery_nature` - 无索引

### 问题 3：使用 DATE() 函数
- `DATE(ir.planned_unload_at)` 和 `DATE(da.confirmed_start)` 导致无法使用索引
- PostgreSQL 无法在函数结果上使用索引

### 问题 4：N+1 查询问题
- 每个仓点每天单独查询，没有批量聚合

---

## 🚀 优化方案（按优先级排序）

### 方案 1：批量查询 + 内存聚合（推荐，立即实施）

**核心思路**：一次性查询所有需要的数据，在内存中聚合

**优势**：
- ✅ 将 675 次查询减少到 **3-5 次查询**
- ✅ 实现简单，风险低
- ✅ 立即见效

**实现步骤**：

1. **批量查询历史库存**（1 次查询）
   ```sql
   SELECT 
     od.delivery_location,
     od.delivery_nature,
     SUM(il.remaining_pallet_count) as sum
   FROM wms.inventory_lots il
   INNER JOIN order_detail od ON il.order_detail_id = od.id
   WHERE il.received_date < '2025-12-11'::DATE
     AND il.status = 'available'
   GROUP BY od.delivery_location, od.delivery_nature
   ```

2. **批量查询计划入库**（1 次查询，查询 15 天范围）
   ```sql
   SELECT 
     ir.planned_unload_at::DATE as date,
     od.delivery_location,
     od.delivery_nature,
     CASE 
       WHEN ir.status = 'received' AND il.remaining_pallet_count IS NOT NULL 
       THEN il.remaining_pallet_count
       ELSE COALESCE(od.estimated_pallets, 0)
     END as pallets
   FROM wms.inbound_receipt ir
   INNER JOIN orders o ON ir.order_id = o.order_id
   INNER JOIN order_detail od ON o.order_id = od.order_id
   LEFT JOIN wms.inventory_lots il ON il.order_detail_id = od.id 
     AND il.status = 'available'
     AND il.inbound_receipt_id = ir.inbound_receipt_id
   WHERE ir.planned_unload_at >= '2025-12-11'::DATE
     AND ir.planned_unload_at <= '2025-12-25'::DATE
     AND ir.status != 'cancelled'
   ```

3. **批量查询计划出库**（1 次查询，查询 15 天范围）
   ```sql
   SELECT 
     da.confirmed_start::DATE as date,
     od.delivery_location,
     od.delivery_nature,
     SUM(adl.estimated_pallets) as sum
   FROM oms.appointment_detail_lines adl
   INNER JOIN order_detail od ON adl.order_detail_id = od.id
   INNER JOIN oms.delivery_appointments da ON adl.appointment_id = da.appointment_id
   WHERE da.confirmed_start >= '2025-12-11'::TIMESTAMPTZ
     AND da.confirmed_start < '2025-12-26'::TIMESTAMPTZ
     AND da.status = 'confirmed'
   GROUP BY da.confirmed_start::DATE, od.delivery_location, od.delivery_nature
   ```

4. **在内存中聚合**：将查询结果按仓点和日期分组，计算预测值

**预期效果**：
- 查询次数：675 次 → **3 次**
- 响应时间：预计从 20-30 秒 → **2-5 秒**

---

### 方案 2：添加关键索引（必须，立即实施）

**创建索引**：

```sql
-- 入库日期索引
CREATE INDEX IF NOT EXISTS idx_inbound_receipt_planned_unload_at 
ON wms.inbound_receipt(planned_unload_at) 
WHERE status != 'cancelled';

-- 预约确认时间索引
CREATE INDEX IF NOT EXISTS idx_delivery_appointments_confirmed_start 
ON oms.delivery_appointments(confirmed_start) 
WHERE status = 'confirmed';

-- 库存接收日期索引
CREATE INDEX IF NOT EXISTS idx_inventory_lots_received_date_status 
ON wms.inventory_lots(received_date, status) 
WHERE status = 'available';

-- 订单明细仓点索引
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_location 
ON order_detail(delivery_location) 
WHERE delivery_location IS NOT NULL;

-- 订单明细送仓性质索引
CREATE INDEX IF NOT EXISTS idx_order_detail_delivery_nature 
ON order_detail(delivery_nature) 
WHERE delivery_nature IS NOT NULL;

-- 复合索引：订单明细（仓点 + 送仓性质）
CREATE INDEX IF NOT EXISTS idx_order_detail_location_nature 
ON order_detail(delivery_location, delivery_nature) 
WHERE delivery_location IS NOT NULL AND delivery_nature IS NOT NULL;
```

**预期效果**：
- 单次查询速度提升：**5-10 倍**
- 配合方案 1，整体速度提升：**10-20 倍**

---

### 方案 3：物化视图 / 汇总表（中期优化）

**核心思路**：创建每日汇总表，定时更新

**表结构**：
```sql
CREATE TABLE analytics.inventory_daily_summary (
  summary_date DATE NOT NULL,
  location_id BIGINT,
  location_group VARCHAR(50) NOT NULL,
  location_name VARCHAR(200) NOT NULL,
  historical_inventory INTEGER DEFAULT 0,
  daily_inbound INTEGER DEFAULT 0,
  daily_outbound INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (summary_date, location_id, location_group)
);

CREATE INDEX idx_inventory_daily_summary_date 
ON analytics.inventory_daily_summary(summary_date);
```

**更新策略**：
- 每天凌晨 2 点自动更新（通过 Netlify Scheduled Functions）
- 或者：每次数据变更时增量更新

**查询优化**：
- 预测计算直接从汇总表读取，无需实时计算
- 15 天预测只需查询汇总表，速度极快

**预期效果**：
- 查询时间：**< 1 秒**
- 适合：实时性要求不高的场景

---

### 方案 4：优化 SQL 查询（配合方案 1）

**问题**：使用 `DATE()` 函数导致无法使用索引

**解决方案**：
- 对于 `DATE` 类型字段（如 `planned_unload_at`），直接比较，不使用 `DATE()` 函数
- 对于 `TIMESTAMPTZ` 类型字段（如 `confirmed_start`），使用范围查询：
  ```sql
  WHERE da.confirmed_start >= '2025-12-11 00:00:00'::TIMESTAMPTZ
    AND da.confirmed_start < '2025-12-12 00:00:00'::TIMESTAMPTZ
  ```
  而不是：
  ```sql
  WHERE DATE(da.confirmed_start) = '2025-12-11'::DATE
  ```

**预期效果**：
- 索引使用率提升：**100%**
- 查询速度提升：**2-3 倍**

---

## 📈 优化效果预估

| 方案 | 实施难度 | 效果 | 推荐优先级 |
|------|---------|------|-----------|
| 方案 1：批量查询 | ⭐⭐ 简单 | ⭐⭐⭐⭐⭐ 极高 | 🔥 立即 |
| 方案 2：添加索引 | ⭐ 极简单 | ⭐⭐⭐⭐ 高 | 🔥 立即 |
| 方案 4：优化 SQL | ⭐⭐ 简单 | ⭐⭐⭐ 中 | ✅ 配合方案 1 |
| 方案 3：汇总表 | ⭐⭐⭐⭐ 复杂 | ⭐⭐⭐⭐⭐ 极高 | 📅 中期 |

---

## 🎯 推荐实施顺序

### 第一阶段（立即实施，预计 1-2 小时）
1. ✅ **方案 2**：添加关键索引（5 分钟）
2. ✅ **方案 1**：批量查询 + 内存聚合（1-2 小时）
3. ✅ **方案 4**：优化 SQL，移除 `DATE()` 函数（30 分钟）

**预期效果**：响应时间从 20-30 秒 → **2-5 秒**

### 第二阶段（中期优化，预计 1-2 天）
4. ✅ **方案 3**：创建汇总表 + 定时更新

**预期效果**：响应时间从 2-5 秒 → **< 1 秒**

---

## 💡 额外建议

### 1. 缓存策略
- 如果数据更新不频繁，可以在 API 层添加缓存（Redis 或内存缓存）
- 缓存时间：5-10 分钟

### 2. 异步计算
- 对于"重新计算"按钮，可以改为异步任务
- 前端显示"计算中..."，后台计算完成后通知前端刷新

### 3. 增量更新
- 如果只是部分数据变更，可以只重新计算受影响的天数和仓点
- 而不是每次都全量计算 15 天 × 15 个仓点

---

## ❓ 需要确认的问题

1. **数据更新频率**：数据多久更新一次？是否需要实时？
2. **计算频率**：用户多久点击一次"重新计算"？
3. **数据量**：当前数据库中有多少条记录？
   - `inventory_lots` 表：约 ? 条
   - `inbound_receipt` 表：约 ? 条
   - `delivery_appointments` 表：约 ? 条

---

## 📝 实施建议

**建议先实施方案 1 + 方案 2 + 方案 4**，这三个方案：
- ✅ 实施简单，风险低
- ✅ 立即见效，性能提升明显
- ✅ 不需要改变现有架构

如果这三个方案实施后性能仍不满足需求，再考虑方案 3（汇总表）。

