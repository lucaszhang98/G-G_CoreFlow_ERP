/**
 * 通用表格配置类型定义
 */

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Eye, Trash2 } from "lucide-react"

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
    /** 自定义操作按钮 */
    customActions?: Array<{
      label: string
      icon?: React.ReactNode
      onClick: (row: TData) => void
      variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    }>
  }
}

/**
 * 创建带操作列的标准表格列配置
 */
export function createTableColumns<TData>(
  config: TableConfig<TData>
): ColumnDef<TData>[] {
  const { columns, sortableColumns = [], actionsConfig } = config
  
  // 处理列排序配置
  const processedColumns = columns.map((col) => {
    // 获取列ID（优先使用 id，否则使用 accessorKey）
    const columnId = col.id || ((col as any).accessorKey as string)
    
    // 如果没有指定可排序列，或者该列在可排序列表中，则允许排序
    const canSort =
      sortableColumns.length === 0 || sortableColumns.includes(columnId)
    
    return {
      ...col,
      enableSorting: canSort,
    } as ColumnDef<TData>
  })
  
  // 添加操作列
  if (actionsConfig && config.showActions !== false) {
    processedColumns.push({
      id: "actions",
      header: () => <div className="text-center">操作</div>,
      cell: ({ row }) => {
        const actions: React.ReactNode[] = []
        
        // 查看详情按钮 - 使用明显的蓝色按钮样式，不使用variant避免样式覆盖
        if (actionsConfig.onView) {
          actions.push(
            <button
              key="view"
              onClick={() => actionsConfig.onView?.(row.original)}
              className="h-8 px-3 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="h-4 w-4" />
              查看详情
            </button>
          )
        }
        
        // 删除按钮 - 使用明显的红色按钮样式，不使用variant避免样式覆盖
        if (actionsConfig.onDelete) {
          actions.push(
            <button
              key="delete"
              onClick={() => actionsConfig.onDelete?.(row.original)}
              className="h-8 px-3 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          )
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

