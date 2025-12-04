/**
 * 通用表格配置类型定义
 */

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Eye, Trash2, Pencil, Save, X } from "lucide-react"
import { autoFormatDateField, isDateField, isDateTimeField, formatDateTimeDisplay } from "@/lib/utils/date-format"
import { ClickableCell } from "@/components/ui/clickable-cell"

/**
 * 列排序配置
 */
export interface ColumnSortConfig {
  /** 列ID */
  id: string
  /** 是否可排序，默认 true */
  enableSorting?: boolean
}

/**
 * 可点击列配置
 */
export interface ClickableColumnConfig<TData> {
  /** 列ID或 accessorKey */
  columnId: string
  /** 点击回调函数 */
  onClick: (row: TData) => void
  /** 是否禁用（根据行数据判断） */
  disabled?: (row: TData) => boolean
  /** 是否显示外部链接图标 */
  showIcon?: boolean
  /** 是否加粗显示 */
  bold?: boolean
  /** Tooltip 提示文本生成函数 */
  getTitle?: (row: TData) => string
}

/**
 * 表格配置
 */
export interface TableConfig<TData> {
  /** 列配置（包含操作列） */
  columns: ColumnDef<TData>[]
  /** 可排序的列ID列表（如果未指定，则所有列都可排序） */
  sortableColumns?: string[]
  /** 列标签映射（用于列可见性控制） */
  columnLabels?: Record<string, string>
  /** 是否显示操作列 */
  showActions?: boolean
  /** 操作列配置 */
  actionsConfig?: {
    /** 查看详情回调 */
    onView?: (row: TData) => void
    /** 删除回调 */
    onDelete?: (row: TData) => void
    /** 编辑回调（行内编辑） */
    onEdit?: (row: TData) => void
    /** 保存回调（行内编辑） */
    onSave?: (row: TData, updates: Record<string, any>) => Promise<void> | void
    /** 取消编辑回调（行内编辑） */
    onCancelEdit?: (row: TData) => void
    /** 是否正在编辑该行 */
    isEditing?: (row: TData) => boolean
    /** 自定义操作按钮 */
    customActions?: Array<{
      label: string
      icon?: React.ReactNode
      onClick: (row: TData) => void
      variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    }>
  }
  /** 可点击列配置（用于将普通列转换为可点击链接） */
  clickableColumns?: ClickableColumnConfig<TData>[]
}

/**
 * 创建带操作列的标准表格列配置
 * 自动为日期字段应用统一的格式化（不包含年份）
 */
export function createTableColumns<TData>(
  config: TableConfig<TData>
): ColumnDef<TData>[] {
  const { columns, sortableColumns = [], actionsConfig, clickableColumns = [] } = config
  
  // 处理列排序配置，自动格式化日期字段，并应用可点击列配置
  const processedColumns = columns.map((col) => {
    // 获取列ID（优先使用 id，否则使用 accessorKey）
    const columnId = col.id || ((col as any).accessorKey as string)
    
    // 如果没有指定可排序列，或者该列在可排序列表中，则允许排序
    const canSort =
      sortableColumns.length === 0 || sortableColumns.includes(columnId)
    
    // 检查是否配置为可点击列
    const clickableConfig = clickableColumns.find(
      (cc) => cc.columnId === columnId
    )
    
    // 如果列已经有自定义的 cell 渲染器，保留它
    // 如果没有，且是日期字段，则自动应用格式化
    // 如果配置为可点击列，则应用可点击样式
    const originalCell = col.cell
    let cell = originalCell
    
    // 如果配置为可点击列，包装原有的 cell 或创建新的可点击 cell
    if (clickableConfig) {
      if (originalCell) {
        // 如果已有自定义 cell，包装它使其可点击
        const originalCellFn = originalCell
        cell = ({ row }) => {
          const isDisabled = clickableConfig.disabled
            ? clickableConfig.disabled(row.original)
            : false
          
          const title = clickableConfig.getTitle
            ? clickableConfig.getTitle(row.original)
            : undefined
          
          // 渲染原始 cell 内容
          const cellContent = typeof originalCellFn === 'function'
            ? originalCellFn({ row } as any)
            : originalCellFn
          
          // 提取文本内容（如果是 React 元素，尝试提取 children）
          let textContent: React.ReactNode = cellContent
          if (React.isValidElement(cellContent)) {
            const props = cellContent.props as { children?: React.ReactNode }
            textContent = props?.children || cellContent
          }
          
          return (
            <ClickableCell
              onClick={() => clickableConfig.onClick(row.original)}
              disabled={isDisabled}
              showIcon={clickableConfig.showIcon}
              bold={clickableConfig.bold}
              title={title}
            >
              {textContent}
            </ClickableCell>
          )
        }
      } else {
        // 如果没有自定义 cell，创建新的可点击 cell
        cell = ({ row }) => {
          // 尝试多种方式获取值
          const rowData = row.original as Record<string, any>
          const value = row.getValue(columnId) ?? rowData[columnId] ?? null
          const isDisabled = clickableConfig.disabled
            ? clickableConfig.disabled(row.original)
            : false
          
          const title = clickableConfig.getTitle
            ? clickableConfig.getTitle(row.original)
            : undefined
          
          // 格式化显示值
          let displayValue: React.ReactNode = "-"
          if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'object') {
              displayValue = JSON.stringify(value)
            } else {
              displayValue = String(value)
            }
          }
          
          if (isDateField(columnId, value)) {
            displayValue = autoFormatDateField(columnId, value)
          }
          
          return (
            <ClickableCell
              onClick={() => clickableConfig.onClick(row.original)}
              disabled={isDisabled}
              showIcon={clickableConfig.showIcon}
              bold={clickableConfig.bold}
              title={title}
            >
              {displayValue}
            </ClickableCell>
          )
        }
      }
    } else if (!originalCell && columnId) {
      // 如果没有自定义 cell，且字段名看起来像日期字段，则自动应用格式化
      cell = ({ row }) => {
        const value = row.getValue(columnId)
        // 自动检测并格式化日期时间字段
        if (isDateTimeField(columnId, value)) {
          return <div>{formatDateTimeDisplay(value as Date | string | null | undefined)}</div>
        }
        // 自动检测并格式化日期字段
        if (isDateField(columnId, value)) {
          return <div>{autoFormatDateField(columnId, value as Date | string | null | undefined)}</div>
        }
        // 非日期字段，使用默认显示
        return <div>{value?.toString() || "-"}</div>
      }
    }
    
    return {
      ...col,
      enableSorting: canSort,
      cell: cell || col.cell,
    } as ColumnDef<TData>
  })
  
  // 添加操作列
  if (actionsConfig && config.showActions !== false) {
    processedColumns.push({
      id: "actions",
      header: () => <div className="text-center">操作</div>,
      cell: ({ row }) => {
        const actions: React.ReactNode[] = []
        
        // 检查是否正在编辑该行
        const isEditing = actionsConfig.isEditing?.(row.original) || false

        // 如果正在编辑，显示保存和取消按钮
        if (isEditing) {
          // 保存按钮
          if (actionsConfig.onSave) {
            actions.push(
              <button
                key="save"
                onClick={() => {
                  // 这里需要从行数据中获取编辑的值，由调用者处理
                  actionsConfig.onSave?.(row.original, {})
                }}
                className="h-8 w-8 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="保存"
              >
                <Save className="h-4 w-4" />
              </button>
            )
          }
          
          // 取消按钮
          if (actionsConfig.onCancelEdit) {
            actions.push(
              <button
                key="cancel"
                onClick={() => actionsConfig.onCancelEdit?.(row.original)}
                className="h-8 w-8 rounded-md text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 active:bg-gray-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="取消"
              >
                <X className="h-4 w-4" />
              </button>
            )
          }
        } else {
          // 未编辑状态：显示查看详情、编辑、删除按钮
          
          // 查看详情按钮 - 只显示图标
          if (actionsConfig.onView) {
            actions.push(
              <button
                key="view"
                onClick={() => actionsConfig.onView?.(row.original)}
                className="h-8 w-8 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="查看详情"
              >
                <Eye className="h-4 w-4" />
              </button>
            )
          }
          
          // 编辑按钮 - 只显示图标
          if (actionsConfig.onEdit) {
            actions.push(
              <button
                key="edit"
                onClick={() => actionsConfig.onEdit?.(row.original)}
                className="h-8 w-8 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="编辑"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )
          }
          
          // 删除按钮 - 只显示图标
          if (actionsConfig.onDelete) {
            actions.push(
              <button
                key="delete"
                onClick={() => actionsConfig.onDelete?.(row.original)}
                className="h-8 w-8 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )
          }
        }
        
        // 自定义操作按钮
        if (actionsConfig.customActions) {
          actionsConfig.customActions.forEach((action, index) => {
            actions.push(
              <Button
                key={`custom-${index}`}
                onClick={() => action.onClick(row.original)}
                variant={action.variant || "default"}
                size="sm"
                className="h-8 px-3"
              >
                {action.icon && <span className="mr-1">{action.icon}</span>}
                {action.label}
              </Button>
            )
          })
        }
        
        return (
          <div className="flex items-center justify-center gap-2">
            {actions}
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    } as ColumnDef<TData>)
  }
  
  return processedColumns
}

