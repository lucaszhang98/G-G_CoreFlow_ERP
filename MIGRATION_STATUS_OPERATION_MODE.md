# 订单状态字段重构迁移说明

## 概述

将 `orders.status` 字段中的操作方式（'unload'、'direct_delivery'）迁移到 `operation_mode` 字段，`status` 字段只保留真正的订单状态（'pending'、'confirmed'、'shipped'、'delivered'、'cancelled'、'archived'）。

## 数据库迁移步骤

### 1. 执行数据迁移脚本

**重要：执行前请备份数据库！**

```bash
# 连接到 Neon 数据库，执行迁移脚本
psql $DATABASE_URL -f scripts/migrate-order-status-to-operation-mode.sql
```

或者直接在 Neon 控制台执行 SQL：

```sql
-- 步骤1：将 status 中的 'unload' 和 'direct_delivery' 迁移到 operation_mode
UPDATE public.orders
SET operation_mode = status
WHERE status IN ('unload', 'direct_delivery')
  AND (operation_mode IS NULL OR operation_mode = '');

-- 步骤2：将 status 中的 'unload' 和 'direct_delivery' 改为 'pending'
UPDATE public.orders
SET status = 'pending'
WHERE status IN ('unload', 'direct_delivery');
```

### 2. 验证迁移结果

```sql
-- 检查迁移结果
SELECT 
  status,
  operation_mode,
  COUNT(*) as count
FROM public.orders
GROUP BY status, operation_mode
ORDER BY status, operation_mode;
```

预期结果：
- `status` 字段应该只包含：'pending'、'confirmed'、'shipped'、'delivered'、'cancelled'、'archived'
- `operation_mode` 字段应该包含：'unload'、'direct_delivery' 或 NULL

## 代码修改清单

### ✅ 已完成的修改

1. **数据库 Schema** (`prisma/schema.prisma`)
   - `operation_mode` 字段已存在，无需修改
   - `status` 字段定义保持不变（默认值 'pending'）

2. **订单配置** (`lib/crud/configs/orders.ts`)
   - ✅ `status` 字段选项：移除了 'unload' 和 'direct_delivery'
   - ✅ `operation_mode` 字段：从隐藏改为可见，添加选项（'unload'、'direct_delivery'）
   - ✅ 列表列：添加了 `operation_mode` 列
   - ✅ 行内编辑：添加了 `operation_mode` 字段
   - ✅ 批量编辑：添加了 `operation_mode` 字段
   - ✅ 表单字段：添加了 `operation_mode` 字段

3. **验证逻辑** (`lib/validations/order.ts`)
   - ✅ `status` 枚举：移除了 'unload' 和 'direct_delivery'
   - ✅ 添加了 `operation_mode` 字段验证

4. **API 逻辑** (`lib/crud/api-handler.ts`)
   - ✅ 订单创建：从 `status === 'unload'` 改为 `operation_mode === 'unload'`
   - ✅ 订单更新：从检查 `status` 改为检查 `operation_mode`
   - ✅ 入库单创建：当 `operation_mode === 'unload'` 时自动创建
   - ✅ 入库单删除：当 `operation_mode` 从 'unload' 变为其他值时自动删除

5. **入库管理查询** (`app/api/wms/inbound-receipts/route.ts`)
   - ✅ 查询条件：从 `orders.status = 'unload'` 改为 `orders.operation_mode = 'unload'`
   - ✅ 搜索条件：更新为使用 `operation_mode`

6. **前端组件** (`app/dashboard/oms/orders/create-order-dialog.tsx`)
   - ✅ 状态字段：只包含真正的状态选项
   - ✅ 操作方式字段：新增独立的操作方式选择
   - ✅ 提交逻辑：添加了 `operation_mode` 字段

## 业务逻辑说明

### 入库单自动创建/删除逻辑

1. **订单创建时**：
   - 如果 `operation_mode === 'unload'`，自动创建入库单（状态：pending）

2. **订单更新时**：
   - 如果 `operation_mode` 从非 'unload' 变为 'unload'，自动创建入库单
   - 如果 `operation_mode` 从 'unload' 变为其他值（如 'direct_delivery'），自动删除入库单
     - 前提：入库单状态为 'pending' 且没有库存批次
     - 如果已有库存批次，保留入库单并记录警告

### 数据一致性

- 入库管理只显示 `operation_mode = 'unload'` 的订单
- 入库单与订单是一对一关系（通过 `order_id` 唯一约束保证）

## 测试检查清单

- [ ] 执行数据库迁移脚本
- [ ] 验证现有订单数据迁移正确
- [ ] 测试创建订单（操作方式：拆柜）
- [ ] 测试创建订单（操作方式：直送）
- [ ] 测试创建订单（操作方式：未选择）
- [ ] 测试修改订单操作方式（从其他改为拆柜）
- [ ] 测试修改订单操作方式（从拆柜改为直送）
- [ ] 测试入库管理列表显示
- [ ] 测试订单列表显示（状态和操作方式列）
- [ ] 测试订单行内编辑（状态和操作方式）
- [ ] 测试订单批量编辑（状态和操作方式）

## 注意事项

1. **数据迁移**：迁移脚本会修改现有数据，执行前必须备份
2. **向后兼容**：如果迁移前有订单的 `status` 是 'unload' 或 'direct_delivery'，迁移后这些订单的 `status` 会变为 'pending'
3. **入库单删除**：只有当入库单状态为 'pending' 且没有库存批次时才会自动删除，已有库存批次的入库单会保留
4. **默认值**：新建订单时，`status` 默认为 'pending'，`operation_mode` 默认为 NULL（需要用户选择）

## 回滚方案

如果迁移出现问题，可以执行以下 SQL 回滚：

```sql
-- 回滚：将 operation_mode 中的值还原到 status
UPDATE public.orders
SET status = operation_mode
WHERE operation_mode IN ('unload', 'direct_delivery')
  AND status = 'pending';

-- 清空 operation_mode（可选）
UPDATE public.orders
SET operation_mode = NULL
WHERE operation_mode IN ('unload', 'direct_delivery');
```

**注意**：回滚后需要恢复代码到之前的版本。

