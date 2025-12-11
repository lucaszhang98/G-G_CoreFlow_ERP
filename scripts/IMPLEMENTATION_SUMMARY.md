# 库存预测报表实现总结

## ✅ 已完成的功能

### 1. 数据库结构
- ✅ 创建 `analytics` schema
- ✅ 创建 `inventory_forecast_daily` 表
- ✅ 添加索引优化查询性能
- ✅ 更新 Prisma schema

### 2. 计算逻辑
- ✅ 获取所有仓点行（亚马逊/FEDEX/UPS/私仓/扣货）
- ✅ 计算历史库存（截至指定日期之前）
- ✅ 计算预计入库（planned_unload_at）
- ✅ 计算预计出库（confirmed_start）
- ✅ 实现15天循环计算逻辑

### 3. API 接口
- ✅ `GET /api/reports/inventory-forecast` - 获取预测数据
- ✅ `POST /api/reports/inventory-forecast/calculate` - 手动触发计算

### 4. 前端页面
- ✅ 创建报表页面（表格视图）
- ✅ 显示15天预测数据
- ✅ 支持手动触发计算
- ✅ 更新侧边栏菜单

## 📁 文件清单

### 数据库
- `web/scripts/create-inventory-forecast-table.sql` - 表结构 SQL

### 后端
- `web/lib/services/inventory-forecast-service.ts` - 计算逻辑服务
- `web/app/api/reports/inventory-forecast/route.ts` - 查询 API
- `web/app/api/reports/inventory-forecast/calculate/route.ts` - 计算 API

### 前端
- `web/app/dashboard/reports/inventory-forecast/page.tsx` - 报表页面

### 配置
- `web/prisma/schema.prisma` - 已更新，添加 analytics schema 和模型
- `web/components/sidebar.tsx` - 已更新，添加菜单项

### 文档
- `web/scripts/README-inventory-forecast.md` - 使用说明

## 🚀 下一步操作

### 1. 执行数据库迁移

```bash
# 连接到数据库执行 SQL
psql $DATABASE_URL -f web/scripts/create-inventory-forecast-table.sql
```

### 2. 生成 Prisma Client

```bash
cd web
npx prisma generate
```

### 3. 首次计算数据

访问 `/dashboard/reports/inventory-forecast`，点击"重新计算"按钮。

或者通过 API：

```bash
curl -X POST http://localhost:3000/api/reports/inventory-forecast/calculate \
  -H "Cookie: your-session-cookie"
```

### 4. 设置定时任务（可选）

可以设置 cron 任务每天自动计算，或使用 node-cron 在应用内设置。

## 📊 数据流程

```
源数据表
  ↓
计算服务 (inventory-forecast-service.ts)
  ↓
汇总表 (analytics.inventory_forecast_daily)
  ↓
API 接口 (/api/reports/inventory-forecast)
  ↓
前端页面 (/dashboard/reports/inventory-forecast)
```

## 🔍 数据计算说明

### 仓点行
- **亚马逊仓点**：每个仓点一行，从 `order_detail.delivery_location` 匹配 `locations.location_type = 'amazon'`
- **FEDEX**：一行，匹配 `locations.location_code = 'FEDEX'`
- **UPS**：一行，匹配 `locations.location_code = 'UPS'`
- **私仓**：一行，汇总所有 `delivery_nature = '私仓'`
- **扣货**：一行，汇总所有 `delivery_nature = '扣货'`

### 时间列
- 第1列：仓点名称
- 第2列：历史库存（截至昨天之前）
- 第3列：当天预计入库
- 第4列：当天预计出库
- 第5列：当天预计库存 = 第2列 + 第3列 - 第4列
- 第6-16列：循环计算到第15天

## ⚠️ 注意事项

1. **首次使用**：需要先执行 SQL 创建表结构
2. **数据依赖**：需要有订单、入库、出库数据才能计算
3. **计算时间**：首次计算可能需要 20-30 秒
4. **权限**：只有管理员可以手动触发计算

## 🐛 故障排查

### 问题：表不存在
- 执行 `create-inventory-forecast-table.sql`

### 问题：Prisma 错误
- 运行 `npx prisma generate`

### 问题：没有数据
- 检查源数据是否存在
- 手动触发计算，查看控制台日志

### 问题：计算失败
- 查看服务器日志
- 检查数据库连接
- 确认 SQL 查询是否正确

