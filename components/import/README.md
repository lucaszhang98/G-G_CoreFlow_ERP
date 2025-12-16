# 通用批量导入Dialog框架

## 📋 简介

`BaseImportDialog` 是一个简洁高效的批量导入Dialog框架模板，适用于所有主数据和业务数据的批量导入功能。

## ✨ 特性

- ✅ **简洁设计**：3步式可折叠面板，无冗余信息
- ✅ **统一交互**：所有导入功能体验一致
- ✅ **拖拽上传**：支持点击选择或拖拽文件
- ✅ **实时反馈**：详细的错误提示和成功提示
- ✅ **Windows友好**：粘贴提示为Windows用户优化

## 🚀 使用方法

### 1. 创建具体的导入Dialog

```typescript
"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateCustomerImportTemplate, downloadCustomerExcelFile } from "@/lib/utils/customer-excel-template"

interface CustomerImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="客户批量导入"
      description="支持批量导入客户信息。请先下载模板，填写数据后上传。"
      requiredFields="客户代码、客户名称"
      apiEndpoint="/api/customers/import"
      templateFilename="客户导入模板"
      generateTemplate={generateCustomerImportTemplate}
      downloadTemplate={downloadCustomerExcelFile}
    />
  )
}
```

### 2. 参数说明

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `title` | string | 是 | Dialog标题 | "客户批量导入" |
| `description` | string | 是 | Dialog描述 | "支持批量导入客户信息。请先下载模板，填写数据后上传。" |
| `requiredFields` | string | 是 | 必填字段列表 | "客户代码、客户名称" |
| `apiEndpoint` | string | 是 | 导入API端点 | "/api/customers/import" |
| `templateFilename` | string | 是 | 模板文件名（不含日期和扩展名） | "客户导入模板" |
| `generateTemplate` | function | 是 | 生成Excel模板的函数 | `generateCustomerImportTemplate` |
| `downloadTemplate` | function | 是 | 下载Excel文件的函数 | `downloadCustomerExcelFile` |
| `templateDataEndpoint` | string | 否 | 模板数据API端点（用于需要先获取参考数据的场景） | "/api/oms/orders/import/template" |

### 3. 完整示例

```typescript
// 客户管理导入（简单场景）
<BaseImportDialog
  title="客户批量导入"
  description="支持批量导入客户信息。请先下载模板，填写数据后上传。"
  requiredFields="客户代码、客户名称"
  apiEndpoint="/api/customers/import"
  templateFilename="客户导入模板"
  generateTemplate={generateCustomerImportTemplate}
  downloadTemplate={downloadCustomerExcelFile}
  {...dialogProps}
/>

// 订单管理导入（需要参考数据）
<BaseImportDialog
  title="订单批量导入"
  description="支持批量导入订单和订单明细。请先下载模板，填写数据后上传。"
  requiredFields="订单号、客户代码、订单日期、操作方式、ETA、MBL、DO、送仓地点、性质、货柜类型、数量、体积"
  apiEndpoint="/api/oms/orders/import"
  templateFilename="订单导入模板"
  templateDataEndpoint="/api/oms/orders/import/template"  // 🔥 新增：先获取参考数据
  generateTemplate={generateOrderImportTemplate}
  downloadTemplate={downloadExcelFile}
  {...dialogProps}
/>

// 位置管理导入
<BaseImportDialog
  title="位置批量导入"
  description="支持批量导入位置信息。请先下载模板，填写数据后上传。"
  requiredFields="位置代码、位置名称、位置类型"
  apiEndpoint="/api/locations/import"
  templateFilename="位置导入模板"
  generateTemplate={generateLocationImportTemplate}
  downloadTemplate={downloadLocationExcelFile}
  {...dialogProps}
/>

// 货柜管理导入
<BaseImportDialog
  title="货柜批量导入"
  description="支持批量导入货柜信息。请先下载模板，填写数据后上传。"
  requiredFields="货柜代码、货柜类型"
  apiEndpoint="/api/trailers/import"
  templateFilename="货柜导入模板"
  generateTemplate={generateTrailerImportTemplate}
  downloadTemplate={downloadTrailerExcelFile}
  {...dialogProps}
/>
```

## 📂 文件结构

```
components/import/
├── base-import-dialog.tsx  # 通用批量导入Dialog框架
└── README.md               # 使用文档（本文件）
```

## 🎯 设计原则

1. **简洁至上**：只保留必要信息，避免冗余描述
2. **统一体验**：所有导入功能使用相同的交互模式
3. **用户友好**：Windows系统快捷键提示，拖拽上传
4. **清晰反馈**：详细的错误信息，明确的成功提示

## 📝 注意事项

1. 所有Excel模板生成和下载函数需要返回 `Promise<ExcelJS.Workbook>`
2. API端点需要返回统一的 `ImportResult` 接口
3. 必填字段字符串用顿号分隔，例如："字段1、字段2、字段3"
4. 模板文件名会自动添加日期后缀，例如：`客户导入模板_2025-01-15.xlsx`

## 🔄 迁移指南

### 从旧版Dialog迁移到BaseImportDialog

**旧版代码（冗余）：**
```typescript
export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  // ... 100+ 行重复代码
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* 大量重复的UI代码 */}
      </DialogContent>
    </Dialog>
  )
}
```

**新版代码（简洁）：**
```typescript
export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
  return (
    <BaseImportDialog
      title="客户批量导入"
      description="支持批量导入客户信息。请先下载模板，填写数据后上传。"
      requiredFields="客户代码、客户名称"
      apiEndpoint="/api/customers/import"
      templateFilename="客户导入模板"
      generateTemplate={generateCustomerImportTemplate}
      downloadTemplate={downloadCustomerExcelFile}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  )
}
```

**优势：**
- 代码量减少90%+
- 无重复代码
- 维护更简单
- 体验统一

## 🎉 总结

使用 `BaseImportDialog` 框架，你可以在2分钟内完成一个新的批量导入功能，且保证所有导入功能的交互体验完全一致！
