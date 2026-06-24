'use client'

import * as React from 'react'
import { TableViewManager } from '@/components/table/table-view-manager'

export type TableViewManagerBridgeValue = {
  tableName: string
  currentVisibility: Record<string, boolean>
  currentSizing?: Record<string, number>
  currentOrder?: string[]
  allColumns: string[]
  columnLabels: Record<string, string>
  onViewChange: (
    visibility: Record<string, boolean>,
    sizing?: Record<string, number>,
    order?: string[]
  ) => void
} | null

const TableViewManagerBridgeContext = React.createContext<TableViewManagerBridgeValue>(null)

export function TableViewManagerBridgeProvider({
  value,
  children,
}: {
  value: TableViewManagerBridgeValue
  children: React.ReactNode
}) {
  return (
    <TableViewManagerBridgeContext.Provider value={value}>
      {children}
    </TableViewManagerBridgeContext.Provider>
  )
}

/** 供 EntityTable 工具栏渲染，与 DataTable 内列可见性状态同步 */
export function TableViewManagerToolbarSlot({ className }: { className?: string }) {
  const ctx = React.useContext(TableViewManagerBridgeContext)
  if (!ctx) return null
  return (
    <div className={className}>
      <TableViewManager
        tableName={ctx.tableName}
        currentVisibility={ctx.currentVisibility}
        currentSizing={ctx.currentSizing}
        currentOrder={ctx.currentOrder}
        allColumns={ctx.allColumns}
        columnLabels={ctx.columnLabels}
        onViewChange={ctx.onViewChange}
      />
    </div>
  )
}
