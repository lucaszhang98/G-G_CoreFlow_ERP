# 库存预测报表使用说明

## 功能概述

库存预测报表提供未来15天的库存、入库、出库预测数据，帮助仓库管理人员提前规划。

## 数据库设置

### 1. 创建表结构

执行 SQL 脚本创建表：

```bash
# 连接到数据库后执行
psql $DATABASE_URL -f web/scripts/create-inventory-forecast-table.sql
```

或者在 Neon Console 中直接执行 `web/scripts/create-inventory-forecast-table.sql` 文件内容。

### 2. 更新 Prisma Schema

已更新 `web/prisma/schema.prisma`，添加了 `analytics` schema 和 `inventory_forecast_daily` 模型。

运行 Prisma 生成：

```bash
cd web
npx prisma generate
```

## 使用流程

### 1. 首次使用

1. **创建表结构**：执行 SQL 脚本（见上方）
2. **生成 Prisma Client**：运行 `npx prisma generate`
3. **手动触发计算**：在页面点击"重新计算"按钮，或调用 API：
   ```bash
   curl -X POST http://localhost:3000/api/reports/inventory-forecast/calculate
   ```

### 2. 查看报表

访问：`/dashboard/reports/inventory-forecast`

页面会显示：
- 横向：15天（今天到未来15天）
- 纵向：各仓点（亚马逊仓点、FEDEX、UPS、私仓、扣货）
- 每个单元格显示：预计库存、预计入库、预计出库

### 3. 定时任务（可选）

可以设置定时任务每天自动计算，例如使用 cron：

```bash
# 每天凌晨3点执行
0 3 * * * curl -X POST http://localhost:3000/api/reports/inventory-forecast/calculate
```

或者使用 Node.js 的 node-cron 库在应用内设置定时任务。

## API 接口

### 1. 获取预测数据

```
GET /api/reports/inventory-forecast
```

查询参数：
- `start_date` (可选)：开始日期，格式：YYYY-MM-DD
- `end_date` (可选)：结束日期，格式：YYYY-MM-DD

默认查询未来15天。

### 2. 手动触发计算

```
POST /api/reports/inventory-forecast/calculate
```

需要管理员权限。

## 数据计算逻辑

### 仓点行获取

1. **亚马逊仓点**：从 `order_detail.delivery_location` 提取，匹配 `locations.location_type = 'amazon'`
2. **FEDEX**：匹配 `locations.location_code = 'FEDEX'` 且 `location_type = 'warehouse'`
3. **UPS**：匹配 `locations.location_code = 'UPS'` 且 `location_type = 'warehouse'`
4. **私仓**：汇总所有 `order_detail.delivery_nature = '私仓'` 的数据
5. **扣货**：汇总所有 `order_detail.delivery_nature = '扣货'` 的数据

### 数据计算

- **历史库存**（第1天）：截至昨天之前的所有 `inventory_lots.remaining_pallet_count` 之和
- **历史库存**（第2天及以后）：使用前一天的 `forecast_inventory`
- **预计入库**：`inbound_receipt.planned_unload_at = 该日期` 的 `order_detail.estimated_pallets` 之和
- **预计出库**：`delivery_appointments.confirmed_start = 该日期` 的 `appointment_detail_lines.estimated_pallets` 之和
- **预计库存**：`historical_inventory + planned_inbound - planned_outbound`

## 注意事项

1. **首次计算**：需要先有数据才能计算，确保数据库中有订单、入库、出库数据
2. **计算时间**：首次计算可能需要 20-30 秒，后续计算会更快
3. **数据更新**：数据每天自动更新（如果设置了定时任务），也可以手动触发
4. **权限控制**：只有管理员可以手动触发计算，所有用户都可以查看报表

## 故障排查

### 问题：没有数据

1. 检查表是否创建：`SELECT * FROM analytics.inventory_forecast_daily LIMIT 1;`
2. 检查是否有源数据：订单、入库、出库数据
3. 手动触发计算，查看控制台日志

### 问题：计算失败

1. 查看服务器日志，检查 SQL 错误
2. 确认数据库连接正常
3. 确认 Prisma Client 已生成

### 问题：数据不准确

1. 检查源数据是否正确（订单明细、入库、出库）
2. 检查仓点匹配逻辑（location_code 是否正确）
3. 重新计算数据

