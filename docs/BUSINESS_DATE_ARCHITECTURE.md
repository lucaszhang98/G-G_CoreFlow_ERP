# 业务日期管理架构设计

## 核心原则

**系统永远不允许读取外部时间**。所有业务逻辑都从数据库的 `system_config` 表获取"当前业务日期"。

## 架构设计

### 1. 数据库层

#### 1.1 系统配置表 (`public.system_config`)

存储系统级别的配置信息，包括当前业务日期。

```sql
CREATE TABLE public.system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value VARCHAR(500) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by BIGINT
);
```

**关键配置项：**
- `current_business_date`: 当前业务日期（YYYY-MM-DD 格式）

#### 1.2 数据库函数

**`get_current_business_date()`**
- 用途：获取当前业务日期
- 返回：`DATE` 类型
- 使用场景：所有需要"今天"的业务逻辑都应使用此函数

```sql
SELECT public.get_current_business_date();
```

**`update_business_date(new_date DATE)`**
- 用途：更新业务日期
- 参数：可选，如果不提供则使用数据库当前日期
- 使用场景：定时任务或管理员手动更新

```sql
SELECT public.update_business_date('2025-12-11');
-- 或使用数据库当前日期
SELECT public.update_business_date();
```

### 2. 应用层

#### 2.1 业务日期服务 (`lib/services/business-date-service.ts`)

封装业务日期获取逻辑，提供统一的 API。

```typescript
// 获取当前业务日期
export async function getCurrentBusinessDate(): Promise<string>

// 更新业务日期（需要管理员权限）
export async function updateBusinessDate(dateString?: string): Promise<string>
```

#### 2.2 API 端点

**GET `/api/system/business-date`**
- 用途：获取当前业务日期
- 权限：所有用户
- 返回：`{ business_date: "2025-12-11" }`

**POST `/api/admin/system/business-date`**
- 用途：更新业务日期
- 权限：仅管理员
- 请求体：`{ date?: "2025-12-11" }`（可选，不提供则使用数据库当前日期）

### 3. 定时任务

#### 3.1 数据库定时任务（pg_cron）

如果 Neon DB 支持 `pg_cron` 扩展：

```sql
SELECT cron.schedule(
  'update-business-date-daily',
  '0 0 * * *',  -- 每天 00:00 UTC
  $$SELECT public.update_business_date()$$
);
```

#### 3.2 应用层定时任务（Node.js cron）

如果无法使用 `pg_cron`，可以在应用层实现：

```typescript
// lib/cron/update-business-date.ts
import cron from 'node-cron'
import { updateBusinessDate } from '@/lib/services/business-date-service'

// 每天 00:00 UTC 执行（对应美西时间前一天的 16:00 PST 或 17:00 PDT）
cron.schedule('0 0 * * *', async () => {
  await updateBusinessDate()
})
```

#### 3.3 云服务定时任务（Vercel Cron Jobs）

如果使用 Vercel 部署，可以使用 Vercel Cron Jobs：

```typescript
// app/api/cron/update-business-date/route.ts
export async function GET(request: Request) {
  // 验证 cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  await updateBusinessDate()
  return Response.json({ success: true })
}
```

在 `vercel.json` 中配置：

```json
{
  "crons": [{
    "path": "/api/cron/update-business-date",
    "schedule": "0 0 * * *"
  }]
}
```

## 使用指南

### 在业务逻辑中使用业务日期

**❌ 错误做法：**
```typescript
// 不要使用系统时间
const today = new Date()
const todayString = formatDateString(today)
```

**✅ 正确做法：**
```typescript
// 从数据库获取业务日期
import { getCurrentBusinessDate } from '@/lib/services/business-date-service'

const businessDate = await getCurrentBusinessDate()
```

### 在 SQL 查询中使用业务日期

**❌ 错误做法：**
```sql
-- 不要使用 CURRENT_DATE
WHERE forecast_date >= CURRENT_DATE
```

**✅ 正确做法：**
```sql
-- 使用业务日期函数
WHERE forecast_date >= public.get_current_business_date()
```

### 在 Prisma 查询中使用业务日期

```typescript
// 先获取业务日期
const businessDate = await getCurrentBusinessDate()

// 在查询中使用
const results = await prisma.$queryRaw`
  SELECT * FROM analytics.inventory_forecast_daily
  WHERE forecast_date >= ${businessDate}::DATE
`
```

## 时区处理

### 数据库时区

- Neon DB 默认时区：`UTC` (GMT)
- 所有 `TIMESTAMPTZ` 字段以 UTC 存储
- `DATE` 字段不涉及时区，直接存储日期

### 业务日期时区

- 业务日期存储在 `system_config` 表中，格式为 `YYYY-MM-DD`
- 不涉及时区转换，直接作为日期字符串处理
- 业务团队约定：所有业务日期都按照美西时间（PST/PDT）理解

### 定时任务时区

- 定时任务在 UTC 时间执行（数据库时区）
- 如果需要美西时间 00:00 更新，需要计算 UTC 时间偏移：
  - PST (11月-3月): UTC 08:00
  - PDT (3月-11月): UTC 07:00

## 迁移指南

### 现有代码迁移

1. **查找所有使用 `new Date()` 或 `CURRENT_DATE` 的地方**
   ```bash
   grep -r "new Date()" web/
   grep -r "CURRENT_DATE" web/
   ```

2. **替换为业务日期服务**
   - 前端：从 API 获取业务日期
   - 后端：使用 `getCurrentBusinessDate()`
   - SQL：使用 `public.get_current_business_date()`

3. **更新库存预测服务**
   - `calculateInventoryForecast()` 应使用业务日期作为基准
   - API 端点应返回业务日期范围

## 注意事项

1. **初始化业务日期**
   - 首次部署时，需要手动设置初始业务日期
   - 可以通过 API 或直接 SQL 插入

2. **业务日期更新时机**
   - 建议在每天 00:00（美西时间）更新
   - 也可以根据业务需求调整（如工作日更新）

3. **时区一致性**
   - 确保所有业务逻辑都使用业务日期，而不是系统时间
   - 前端显示时，直接显示业务日期，不进行时区转换

4. **测试环境**
   - 测试时可以手动设置业务日期，模拟不同日期场景
   - 不需要等待真实时间流逝

## 优势

1. **可测试性**：可以手动设置业务日期，测试不同日期场景
2. **可追溯性**：业务日期变更有记录（`updated_at`）
3. **时区一致性**：所有业务逻辑使用统一的日期基准
4. **灵活性**：可以根据业务需求调整业务日期（如节假日跳过）

