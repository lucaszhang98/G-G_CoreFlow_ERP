# 统一日期格式化框架

## 概述

这是一个自动化的日期格式化框架，确保系统中所有表格和组件中的日期字段都统一使用**不包含年份**的格式显示，以节省空间。

## 核心特性

1. **自动检测日期字段**：通过字段名和值类型自动识别日期字段
2. **智能区分日期和时间戳**：
   - 纯日期（DATE）：显示为 `MM-DD`
   - 时间戳（TIMESTAMPTZ）：显示为 `MM-DD HH:mm`
3. **编辑和存储保持完整格式**：编辑时使用完整格式（`YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm`），存储到数据库时也保持完整格式

## 使用方法

### 1. 在表格列中自动应用

框架会自动在以下位置应用日期格式化：

- **通用表格框架** (`lib/table/config.tsx`)：通过 `createTableColumns` 函数自动检测并格式化日期字段
- **CRUD 表格** (`components/crud/entity-table.tsx`)：自动为 `type: 'date'` 的字段应用格式化
- **实体详情** (`components/crud/entity-detail.tsx`)：自动为日期字段应用格式化

### 2. 手动使用工具函数

如果需要手动格式化日期，可以使用以下函数：

```typescript
import { formatDateDisplay, formatDateTimeDisplay, autoFormatDateField } from "@/lib/utils/date-format"

// 格式化纯日期（MM-DD）
const dateStr = formatDateDisplay(dateValue)

// 格式化日期时间（MM-DD HH:mm）
const dateTimeStr = formatDateTimeDisplay(dateTimeValue)

// 自动检测并格式化（推荐）
const formatted = autoFormatDateField(fieldKey, value)
```

### 3. 在自定义表格中使用

如果创建自定义表格列，框架会自动检测日期字段：

```typescript
import { createTableColumns } from "@/lib/table/config"

const columns = [
  {
    accessorKey: "order_date",
    header: "订单日期",
    // 不需要自定义 cell，框架会自动格式化
  },
  {
    accessorKey: "appointment_time",
    header: "预约时间",
    // 框架会自动识别为时间戳并格式化为 MM-DD HH:mm
  }
]

const processedColumns = createTableColumns({ columns, ... })
```

## 日期字段识别规则

框架通过以下规则自动识别日期字段：

### 字段名模式
- 包含 `date`（如 `order_date`, `created_date`）
- 包含 `time`（如 `appointment_time`, `updated_time`）
- 以 `_at` 结尾（如 `created_at`, `updated_at`）

### 值类型检测
- `Date` 对象
- ISO 日期字符串（`YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ss`）

### 时间戳识别规则
字段名包含以下关键词会被识别为时间戳：
- `time`
- `timestamp`
- `appointment_time`
- `requested_start`, `requested_end`
- `confirmed_start`, `confirmed_end`

或者值包含时间部分（不是 `00:00:00`）

## 编辑和存储

- **显示**：不包含年份（`MM-DD` 或 `MM-DD HH:mm`）
- **编辑**：使用完整格式（`YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm`）
- **存储**：数据库存储完整格式（包含年份）

`EditableCell` 组件已自动处理这个逻辑。

## 覆盖范围

以下组件已自动应用此框架：

1. ✅ `components/crud/entity-table.tsx` - CRUD 表格
2. ✅ `components/crud/entity-detail.tsx` - 实体详情页
3. ✅ `lib/table/config.tsx` - 通用表格配置
4. ✅ `components/ui/editable-cell.tsx` - 可编辑单元格

## 未来扩展

所有新创建的表格和组件都会自动应用此框架，无需额外配置。只需：

1. 使用 `createTableColumns` 创建表格列
2. 或使用 `EntityTable` 组件
3. 或使用 `EditableCell` 组件

框架会自动检测并格式化所有日期字段。

