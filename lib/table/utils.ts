/**
 * 通用表格工具函数
 */

import { ColumnDef } from "@tanstack/react-table"
import { TableConfig, createTableColumns } from "./config"

/**
 * 创建标准化的表格配置
 * 这是一个便捷函数，用于快速创建符合系统标准的表格配置
 */
export function createStandardTableConfig<TData>(
  config: TableConfig<TData>
): {
  columns: ColumnDef<TData>[]
  sortableColumns: string[]
  columnLabels: Record<string, string>
} {
  const { sortableColumns = [], columnLabels = {} } = config
  
  // 生成列标签映射（如果未提供）
  const labels: Record<string, string> = { ...columnLabels }
  
  // 创建列配置（包含操作列）
  const columns = createTableColumns(config)
  
  return {
    columns,
    sortableColumns,
    columnLabels: labels,
  }
}

