# 系统时区处理方式分析

## 📊 当前状态

### 1. **数据库层（Neon DB）**

**时区设置：** GMT（UTC）

**日期字段类型：**
- `@db.Date` - 纯日期，不包含时区信息，存储为 `YYYY-MM-DD`
- `@db.Timestamptz(6)` - 带时区的时间戳，存储为 UTC

**SQL 函数行为：**
- `CURRENT_DATE` - 返回 UTC 时区的当前日期
- `NOW()` - 返回 UTC 时区的当前时间戳
- `DATE()` - 提取日期部分（不转换时区）

**示例：**
```sql
-- 数据库时区：UTC
-- 当前 UTC 时间：2025-12-11 06:19:02 UTC
SELECT CURRENT_DATE;  -- 返回：2025-12-11
SELECT NOW();         -- 返回：2025-12-11 06:19:02.064+00
```

---

### 2. **API 层（后端）**

#### ✅ **已使用 PST 时区工具的地方：**
- `web/lib/services/inventory-forecast-service.ts` - 库存预测计算
- `web/app/api/reports/inventory-forecast/route.ts` - 库存预测 API

#### ⚠️ **问题：混用时区处理方式**

**问题代码示例：**
```typescript
// ❌ 问题：getPSTToday() 返回的 Date 对象仍然是本地时区的 Date
const today = getPSTToday()  // 例如：2025-12-24 00:00:00 (本地时区)
today.setHours(0, 0, 0, 0)

// 传递给 PostgreSQL 时，PostgreSQL 会将其转换为 UTC
// 如果服务器时区是 UTC+8，则：
// 本地：2025-12-24 00:00:00 (UTC+8)
// UTC：  2025-12-23 16:00:00 UTC
// DATE() 提取后：2025-12-23 ❌ 错误！

// SQL 查询中：
WHERE DATE(ir.planned_unload_at) = DATE(${date})  // date 是本地时区的 Date 对象
```

**其他 API 的时区处理：**
- 大部分 API 使用 `new Date()` 创建日期对象（服务器本地时区）
- 使用 `setHours(0, 0, 0, 0)` 设置时间为 00:00:00
- 使用 `toISOString()` 转换为 ISO 字符串（UTC 时区）

---

### 3. **前端层**

#### ✅ **已使用 PST 时区工具的地方：**
- `web/app/dashboard/reports/inventory-forecast/inventory-forecast-client.tsx` - 库存预测前端

#### ⚠️ **问题：混用时区处理方式**

**问题代码示例：**
```typescript
// ❌ 问题：getPSTToday() 返回的 Date 对象仍然是浏览器本地时区的 Date
const today = getPSTToday()  // 例如：2025-12-24 00:00:00 (浏览器本地时区)

// 如果浏览器时区是 UTC+8，则：
// 浏览器：2025-12-24 00:00:00 (UTC+8)
// 转换为 UTC：2025-12-23 16:00:00 UTC
// 发送到 API 时，可能已经是错误的日期了
```

**其他前端的时区处理：**
- 大部分前端使用 `new Date()` 创建日期对象（浏览器本地时区）
- 使用 `toISOString().split('T')[0]` 获取日期字符串
- 使用 `toLocaleString()` 格式化显示（浏览器本地时区）

---

## 🔴 **核心问题**

### 问题 1：`getPSTToday()` 的实现缺陷

**当前实现：**
```typescript
export function getPSTToday(): Date {
  const dateStr = getPSTTodayString()  // "2025-12-24"
  const [year, month, day] = dateStr.split('-').map(Number)
  const pstDate = new Date(year, month - 1, day)  // ❌ 这是本地时区的 Date！
  pstDate.setHours(0, 0, 0, 0)
  return pstDate
}
```

**问题：**
- `new Date(year, month - 1, day)` 创建的是**本地时区**的 Date 对象
- 如果服务器/浏览器时区不是 PST，这个 Date 对象的时间戳是错误的
- 传递给 PostgreSQL 时，PostgreSQL 会将其转换为 UTC，导致日期偏移

**示例：**
```
PST 的 2025-12-24 00:00:00
↓ (如果服务器是 UTC+8)
本地 Date 对象：2025-12-24 00:00:00 (UTC+8)
↓ (传递给 PostgreSQL，转换为 UTC)
UTC：2025-12-23 16:00:00 UTC
↓ (使用 DATE() 提取)
日期：2025-12-23 ❌ 错误！
```

### 问题 2：SQL 查询中的日期比较

**当前代码：**
```typescript
WHERE DATE(ir.planned_unload_at) = DATE(${date})
```

**问题：**
- `${date}` 是 JavaScript 的 Date 对象
- PostgreSQL 会将其转换为 UTC 时区
- 如果服务器时区不是 PST，日期会偏移

### 问题 3：混用的时区处理方式

- 库存预测模块：使用 PST 时区工具（但实现有缺陷）
- 其他模块：使用本地时区（服务器/浏览器时区）
- 数据库：存储为 UTC

**结果：** 时区不一致，导致日期计算错误

---

## ✅ **解决方案**

### 方案 1：统一使用 PST 时区字符串（推荐）

**修改 `getPSTToday()` 和相关函数：**
```typescript
// ✅ 正确：返回 PST 时区的日期字符串，而不是 Date 对象
export function getPSTTodayString(): string {
  const now = new Date()
  const pstDateStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = pstDateStr.split('/')
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

// ✅ 正确：在 SQL 查询中使用日期字符串，而不是 Date 对象
WHERE DATE(ir.planned_unload_at) = ${dateString}::DATE
```

### 方案 2：在 PostgreSQL 中设置时区

**修改数据库连接：**
```typescript
// 在 Prisma 连接字符串中添加时区参数
DATABASE_URL="postgresql://...?timezone=America/Los_Angeles"
```

**或者在 SQL 查询中设置时区：**
```sql
SET timezone = 'America/Los_Angeles';
SELECT CURRENT_DATE;  -- 返回 PST 的当前日期
```

### 方案 3：统一使用 UTC，前端显示时转换

**优点：**
- 数据库和 API 统一使用 UTC
- 前端显示时转换为 PST

**缺点：**
- 需要在前端所有地方都做时区转换
- 容易遗漏

---

## 🎯 **推荐方案**

**推荐使用方案 1 + 方案 2 的组合：**

1. **修改 `timezone.ts` 工具函数：**
   - `getPSTToday()` 返回 PST 时区的日期字符串（而不是 Date 对象）
   - 所有日期比较都使用字符串比较

2. **修改 SQL 查询：**
   - 使用日期字符串而不是 Date 对象
   - 在查询开始时设置时区：`SET timezone = 'America/Los_Angeles'`

3. **统一所有模块：**
   - 所有日期操作都使用 PST 时区工具函数
   - 禁止直接使用 `new Date()` 进行日期计算

---

## 📝 **需要修改的文件**

1. `web/lib/utils/timezone.ts` - 修复时区工具函数
2. `web/lib/services/inventory-forecast-service.ts` - 修改 SQL 查询使用日期字符串
3. `web/app/api/reports/inventory-forecast/route.ts` - 修改日期处理逻辑
4. 其他使用日期的 API 和前端组件

---

## 🔍 **验证方法**

1. **测试日期比较：**
   ```typescript
   // 在 PST 时区的 2025-12-24 00:00:00
   const pstDate = getPSTTodayString()  // "2025-12-24"
   
   // 查询数据库
   SELECT COUNT(*) FROM wms.inbound_receipt 
   WHERE DATE(planned_unload_at) = '2025-12-24'::DATE
   
   // 应该返回正确的记录数
   ```

2. **测试时区转换：**
   ```typescript
   // 在不同时区的服务器上测试
   // 确保返回的日期都是 PST 时区的日期
   ```

3. **测试前端显示：**
   ```typescript
   // 在不同时区的浏览器上测试
   // 确保显示的日期都是 PST 时区的日期
   ```

