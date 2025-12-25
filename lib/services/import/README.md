# 通用导入Service框架

## 概述

通用导入Service框架提供了一套标准化的批量导入解决方案，遵循配置驱动的设计理念。

---

## 架构设计

```
BaseImportService（通用框架）
  ├─ Excel解析
  ├─ 数据验证
  ├─ 错误处理
  └─ 事务协调

ImportConfig（配置）
  ├─ 表头映射
  ├─ 验证Schema
  ├─ 权限要求
  ├─ 重复检查
  └─ 导入逻辑

具体实体Service（配置实例）
  ├─ customer-import.service.ts
  ├─ order-import.service.ts
  ├─ location-import.service.ts
  └─ trailer-import.service.ts
```

---

## 使用方式

### 步骤1：定义ImportConfig

```typescript
import { BaseImportService, ImportConfig } from './import/base-import.service'
import { myEntitySchema, MyEntityRow } from '@/lib/validations/my-entity-import'

const myImportConfig: ImportConfig<MyEntityRow> = {
  // 1. 表头映射（Excel列名 → 字段名）
  headerMap: {
    'Excel列名1': 'field1',
    'Excel列名2': 'field2',
  },

  // 2. 验证Schema
  validationSchema: myEntitySchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'manager'],

  // 4. 检查重复（可选）
  checkDuplicates: async (data, masterData) => {
    const errors = []
    // 检查逻辑
    return errors
  },

  // 5. 预加载主数据（可选）
  loadMasterData: async () => {
    const customers = await prisma.customers.findMany()
    return { customers }
  },

  // 6. 执行导入（核心业务逻辑）
  executeImport: async (data, userId, masterData) => {
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        await tx.myEntity.create({ data: row })
      }
    })
  },
}
```

### 步骤2：创建Service实例

```typescript
export const myImportService = new BaseImportService(myImportConfig)
```

### 步骤3：在API中使用

```typescript
// app/api/my-entity/import/route.ts
import { myImportService } from '@/lib/services/my-import.service'

export async function POST(request: NextRequest) {
  const authResult = await checkAuth()
  if (authResult.error) return authResult.error

  const formData = await request.formData()
  const file = formData.get('file') as File

  // 调用Service
  const result = await myImportService.import(file, BigInt(user.id))

  return NextResponse.json(result)
}
```

---

## 现有实现

### 1. 客户导入（customer-import.service.ts）

**特点**：
- 支持联系人关联创建
- 检查客户代码唯一性
- 事务确保原子性

**API**: `/api/customers/import`

---

### 2. 订单导入（order-import.service.ts）

**特点**：
- 一对多关系（订单+明细）
- 预加载主数据（客户、位置）
- 检查订单字段一致性
- 检查订单号唯一性

**API**: `/api/oms/orders/import`

---

### 3. 位置导入（location-import.service.ts）

**特点**：
- 简单实体导入
- 检查位置代码唯一性

**API**: `/api/locations/import`

---

### 4. 货柜导入（trailer-import.service.ts）

**特点**：
- 简单实体导入
- 检查货柜代码唯一性

**API**: `/api/trailers/import`

---

## 核心优势

### 1. 代码复用

**Before（每个导入写一遍）**：
```
customer-import: 248行
order-import: 326行
location-import: 207行
trailer-import: 193行
总计：974行
```

**After（配置驱动）**：
```
BaseImportService: 150行（通用框架）
customer-import: 150行（配置+业务）
order-import: 290行（配置+业务）
location-import: 115行（配置+业务）
trailer-import: 110行（配置+业务）
总计：815行
```

**减少：16%代码量，且逻辑更清晰！**

---

### 2. 统一的错误处理

所有导入使用相同的错误格式：

```typescript
interface ImportError {
  row: number        // 行号
  field: string      // 字段名
  message: string    // 错误信息
}
```

---

### 3. 统一的结果格式

```typescript
interface ImportResult {
  success: boolean
  imported?: number
  total?: number
  errors?: ImportError[]
}
```

---

### 4. 可测试性

Service层可以独立测试，不依赖HTTP请求：

```typescript
// 单元测试
const service = new BaseImportService(config)
const result = await service.import(mockFile, mockUserId)
expect(result.success).toBe(true)
```

---

## 扩展新的导入功能

### 只需3步

**步骤1**：创建验证Schema

```typescript
// lib/validations/my-entity-import.ts
export const myEntityImportRowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
})
```

**步骤2**：创建导入Service

```typescript
// lib/services/my-import.service.ts
const config: ImportConfig<MyEntityRow> = {
  headerMap: { ... },
  validationSchema: myEntityImportRowSchema,
  requiredRoles: ['admin'],
  executeImport: async (data, userId) => { ... },
}

export const myImportService = new BaseImportService(config)
```

**步骤3**：创建API

```typescript
// app/api/my-entity/import/route.ts
export async function POST(request: NextRequest) {
  // 权限检查
  // 获取文件
  const result = await myImportService.import(file, userId)
  return NextResponse.json(result)
}
```

**完成！** 🎉

---

## 最佳实践

### 1. 简单导入

如果只是简单的实体导入（如客户、位置、货柜）：

- ✅ 直接使用BaseImportService
- ✅ 在config中定义所有逻辑
- ✅ API保持20-30行

### 2. 复杂导入

如果有复杂逻辑（如订单+明细、多表关联）：

- ✅ 继承BaseImportService
- ✅ 重写需要自定义的方法
- ✅ 保持框架的通用性

---

## 维护指南

### 修改导入逻辑

**只需修改Service配置**：

```typescript
// lib/services/customer-import.service.ts

// 修改表头映射
headerMap: {
  '新列名': 'new_field',  // 添加新字段
}

// 修改权限
requiredRoles: ['admin', 'new_role'],  // 添加新角色

// 修改业务逻辑
executeImport: async (data, userId) => {
  // 修改导入逻辑
}
```

**API不需要改！**

---

## 文件结构

```
lib/services/import/
├─ base-import.service.ts      # 通用框架（150行）
├─ types.ts                     # 类型定义
└─ README.md                    # 本文档

lib/services/
├─ customer-import.service.ts   # 客户导入配置
├─ order-import.service.ts      # 订单导入配置
├─ location-import.service.ts   # 位置导入配置
└─ trailer-import.service.ts    # 货柜导入配置
```

---

## 总结

**通用导入Service框架特点**：

1. ✅ **配置驱动**：只需配置，不需重复写框架代码
2. ✅ **类型安全**：TypeScript全程检查
3. ✅ **统一规范**：所有导入使用相同流程
4. ✅ **易于扩展**：添加新导入只需3步
5. ✅ **职责清晰**：API只做转发，Service做业务

**这是Service层的"配置驱动"！**

与UI层的`EntityTable`、API层的`api-handler`一起，构成完整的配置驱动架构。






