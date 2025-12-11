# 时区处理实现方案

## ✅ **核心原则**

根据你的需求，系统采用以下原则：

1. **系统内部统一时区**：所有时间操作都基于系统约定的时区（PST/PDT），但不进行时区转换
2. **不读取外界时间**：所有时间都应该是用户输入或系统内部约定的，不使用 `new Date()` 获取当前时间
3. **统一使用日期字符串**：所有日期比较和计算都使用 `YYYY-MM-DD` 格式的字符串，而不是 Date 对象

---

## 🔧 **已完成的修改**

### 1. **时区工具函数重构** (`web/lib/utils/timezone.ts`)

**新增函数（推荐使用）：**
- `formatDateString()` - 格式化日期字符串为 YYYY-MM-DD
- `addDaysToDateString()` - 在日期字符串基础上加减天数
- `isSameDateString()` - 比较两个日期字符串是否在同一天
- `compareDateStrings()` - 比较两个日期字符串的大小
- `getDayOfWeek()` - 获取星期几
- `getChineseDayOfWeek()` - 获取中文星期几
- `formatDateForDisplay()` - 格式化为显示格式（月-日）

**废弃函数（保留用于向后兼容）：**
- `getPSTTodayString()` - ⚠️ 会读取外界时间，不推荐使用
- `getPSTToday()` - ⚠️ 会读取外界时间，不推荐使用
- `getPSTDateWithOffset()` - ⚠️ 会读取外界时间，不推荐使用

### 2. **库存预测服务修改** (`web/lib/services/inventory-forecast-service.ts`)

**主要变更：**
- ✅ `calculateInventoryForecast()` 现在接受可选的 `baseDateString` 参数
- ✅ 如果不提供基准日期，从数据库获取最后一次计算的日期
- ✅ 所有日期计算都使用日期字符串，而不是 Date 对象
- ✅ 所有 SQL 查询都使用 `::DATE` 类型转换，而不是 Date 对象

**修改的函数：**
- `calculateHistoricalInventory()` - 接受日期字符串
- `calculatePlannedInbound()` - 接受日期字符串
- `calculatePlannedOutbound()` - 接受日期字符串
- `cleanupOldForecastData()` - 接受日期字符串

### 3. **API 路由修改** (`web/app/api/reports/inventory-forecast/route.ts`)

**主要变更：**
- ✅ 移除了所有 `getPSTToday()` 和 `getPSTDateWithOffset()` 的调用
- ✅ 移除了 `CURRENT_DATE` 的使用
- ✅ 如果用户不提供 `start_date`，从数据库获取最后一次计算的日期
- ✅ 所有日期比较都使用日期字符串

---

## 📝 **使用指南**

### **1. 日期格式化**

```typescript
import { formatDateString } from '@/lib/utils/timezone'

// ✅ 正确：格式化日期字符串
const dateStr = formatDateString('2025-12-24')  // "2025-12-24"
const dateStr2 = formatDateString(new Date('2025-12-24'))  // "2025-12-24"
```

### **2. 日期计算**

```typescript
import { addDaysToDateString } from '@/lib/utils/timezone'

// ✅ 正确：在日期字符串基础上加减天数
const tomorrow = addDaysToDateString('2025-12-24', 1)  // "2025-12-25"
const yesterday = addDaysToDateString('2025-12-24', -1)  // "2025-12-23"
```

### **3. 日期比较**

```typescript
import { isSameDateString, compareDateStrings } from '@/lib/utils/timezone'

// ✅ 正确：比较两个日期字符串
const isSame = isSameDateString('2025-12-24', '2025-12-24')  // true
const comparison = compareDateStrings('2025-12-24', '2025-12-25')  // -1 (小于)
```

### **4. SQL 查询中的日期比较**

```typescript
// ✅ 正确：使用日期字符串和 ::DATE 类型转换
const dateString = '2025-12-24'
await prisma.$queryRaw`
  SELECT * FROM wms.inbound_receipt
  WHERE DATE(planned_unload_at) = ${dateString}::DATE
`

// ❌ 错误：使用 Date 对象
const date = new Date('2025-12-24')
await prisma.$queryRaw`
  WHERE DATE(planned_unload_at) = DATE(${date})  // 会转换为 UTC，导致日期偏移
`
```

### **5. 获取基准日期**

```typescript
// ✅ 正确：从数据库获取最后一次计算的日期
const lastCalculation = await prisma.$queryRaw<Array<{ max_date: Date | null }>>`
  SELECT MAX(forecast_date) as max_date
  FROM analytics.inventory_forecast_daily
`

if (lastCalculation[0]?.max_date) {
  const baseDate = formatDateString(lastCalculation[0].max_date)
  // 使用 baseDate 进行计算
}

// ❌ 错误：使用 new Date() 获取当前时间
const today = new Date()  // 会读取外界时间，不符合系统设计原则
```

---

## ⚠️ **注意事项**

### **1. 不要使用废弃的函数**

```typescript
// ❌ 错误：这些函数会读取外界时间
const today = getPSTToday()
const todayStr = getPSTTodayString()
const tomorrow = getPSTDateWithOffset(1)

// ✅ 正确：使用日期字符串和计算函数
const baseDate = '2025-12-24'  // 从用户输入或数据库获取
const tomorrow = addDaysToDateString(baseDate, 1)
```

### **2. 不要使用 SQL 的 CURRENT_DATE 或 NOW()**

```sql
-- ❌ 错误：会读取外界时间
SELECT * FROM table WHERE date_column = CURRENT_DATE

-- ✅ 正确：使用传入的日期字符串
SELECT * FROM table WHERE date_column = ${dateString}::DATE
```

### **3. 时间戳字段的处理**

对于 `created_at`、`updated_at` 等时间戳字段，可以使用数据库的 `NOW()`，因为：
- 这些是系统内部的时间戳，不是业务逻辑的一部分
- 它们用于审计和追踪，不参与业务计算
- 数据库的时区是系统配置的一部分

```typescript
// ✅ 可以：时间戳字段使用 NOW()
await prisma.$executeRaw`
  INSERT INTO table (created_at) VALUES (NOW())
`

// ❌ 错误：业务日期字段使用 NOW()
await prisma.$executeRaw`
  INSERT INTO table (business_date) VALUES (NOW())  // 应该使用用户输入或系统约定的日期
`
```

---

## 🎯 **总结**

系统现在完全符合你的需求：

1. ✅ **系统内部统一时区**：所有日期操作都基于系统约定的时区
2. ✅ **不读取外界时间**：所有时间都是用户输入或系统内部约定的
3. ✅ **统一使用日期字符串**：所有日期比较和计算都使用 `YYYY-MM-DD` 格式的字符串

**关键点：**
- 用户输入什么时间，就存储什么时间，显示什么时间
- 不做时区转换，系统内部统一约定一个时区
- 所有日期操作都使用日期字符串，而不是 Date 对象

