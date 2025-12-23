# 打印服务架构设计

## 设计原则

由于各单据差异极大（横排/竖排、A4/4×6），采用**独立实现**而非过度抽象的策略：

1. **只提炼真正通用的部分**：
   - 页面尺寸常量
   - 日期/数字格式化工具
   - 公司信息获取

2. **每个单据独立实现**：
   - 独立的数据接口（不强制统一）
   - 独立的服务文件
   - 独立的PDF生成逻辑

## 目录结构

```
lib/services/print/
├── README.md                    # 本文档
├── print-templates.ts           # 通用工具和常量
├── types.ts                     # 各单据的数据类型定义
├── unload-sheet.service.ts      # 拆柜单据服务（横排A4）
├── load-sheet.service.ts        # 装车单服务（竖排A4）
├── bol.service.ts               # BOL服务（竖排A4）
└── label.service.ts             # Label服务（4×6英寸）
```

## 各单据规格

| 单据 | 页面尺寸 | 方向 | 特点 |
|------|---------|------|------|
| 拆柜单据 (Unload Sheet) | A4 (297×210mm) | 横排 | 需要显示大量明细和批次信息 |
| 装车单 (Load Sheet) | A4 (210×297mm) | 竖排 | 标准装车清单格式 |
| BOL | A4 (210×297mm) | 竖排 | 标准提单格式 |
| Label | 4×6英寸 (152.4×101.6mm) | 横排 | 紧凑布局，需要条形码 |

## API 路由结构

```
/api/wms/inbound-receipts/[id]/
  └── print/
      ├── unload-sheet/route.ts    # GET: 生成拆柜单据PDF
      └── labels/route.ts           # GET: 生成Label PDF（批量）

/api/wms/outbound-shipments/[id]/
  └── print/
      ├── load-sheet/route.ts      # GET: 生成装车单PDF
      └── bol/route.ts              # GET: 生成BOL PDF
```

## 实现方式

每个服务文件包含：
1. **数据转换函数**：将 Prisma 查询结果转换为该单据所需的数据格式
2. **PDF生成函数**：使用 PDF 库生成该单据的 PDF Buffer

## 使用示例

```typescript
// 拆柜单据
import { generateUnloadSheet } from '@/lib/services/print/unload-sheet.service'
const pdfBuffer = await generateUnloadSheet(inboundReceiptId)

// Label（批量生成）
import { generateLabels } from '@/lib/services/print/label.service'
const pdfBuffer = await generateLabels(orderDetailIds)
```

## 补充功能建议

### 1. 权限控制
- 每个打印功能需要检查用户权限
- 使用现有的 `checkPermission` 机制

### 2. 错误处理
- 数据不存在时返回 404
- PDF 生成失败时返回 500 并记录错误日志

### 3. 缓存策略（可选）
- 如果单据数据未变更，可以缓存生成的 PDF
- 使用 Redis 或文件系统缓存
- 缓存键：`print:${documentType}:${id}:${updatedAt}`

### 4. 打印历史记录（可选）
- 记录每次打印的时间、用户、单据类型
- 可以存储在 `document_links` 表中（已有相关字段）

### 5. 预览功能
- 前端可以通过 iframe 或新窗口预览 PDF
- API 返回 PDF 流，浏览器自动显示

### 6. 批量生成
- Label 可能需要批量生成（一个订单多个明细）
- 支持生成多页 PDF 或 ZIP 压缩包

### 7. 模板版本管理（未来扩展）
- 如果未来需要支持多种模板样式
- 可以在数据库存储模板配置
- 支持 A/B 测试不同的模板设计

### 8. 水印（可选）
- 草稿状态时添加 "DRAFT" 水印
- 已打印的文档添加打印时间水印

### 9. 条码/二维码生成
- Label 需要条码或二维码
- 可以使用 `qrcode` 或 `barcode` 库
- 支持多种条码格式（Code128, QR Code 等）

### 10. 多语言支持（未来扩展）
- 如果未来需要支持英文单据
- 可以在数据转换时根据用户语言选择模板

## 技术选型建议

### PDF 生成库
- **推荐：`@react-pdf/renderer`**
  - React 组件式，与项目技术栈一致
  - 支持服务端渲染
  - 文档完善，社区活跃

- **备选：`pdfkit`**
  - 功能更强大，支持复杂布局
  - 但 API 较底层，开发效率略低

### 条码/二维码库
- **推荐：`qrcode`** (二维码)
- **推荐：`jsbarcode`** (条码)

## 开发优先级

1. ✅ **基础架构**（已完成）
2. 🔄 **拆柜单据 (Unload Sheet)** - 优先级最高
3. ⏳ **Label** - 优先级次之
4. ⏳ **装车单 (Load Sheet)** - 后续
5. ⏳ **BOL** - 后续


