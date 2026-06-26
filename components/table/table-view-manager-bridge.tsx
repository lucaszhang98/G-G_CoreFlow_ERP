'use client'

import * as React from 'react'
import { Columns3 } from 'lucide-react'
import { TableViewManager } from '@/components/table/table-view-manager'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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

/** 列显示下拉：逐列勾选，与 DataTable 列可见性状态同步（用于隐藏操作列、把视图放工具栏的场景） */
function ToolbarColumnVisibilityMenu({ ctx }: { ctx: NonNullable<TableViewManagerBridgeValue> }) {
  const isVisible = React.useCallback(
    (col: string) => ctx.currentVisibility[col] !== false,
    [ctx.currentVisibility]
  )
  const toggleColumn = React.useCallback(
    (col: string, checked: boolean) => {
      const next: Record<string, boolean> = {}
      ctx.allColumns.forEach((c) => {
        next[c] = c === col ? checked : ctx.currentVisibility[c] !== false
      })
      ctx.onViewChange(next, ctx.currentSizing, ctx.currentOrder)
    },
    [ctx]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">列显示</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-[400px] overflow-hidden"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="sticky top-0 bg-popover z-10 py-2 border-b">
          切换列显示
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
          {ctx.allColumns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col}
              checked={isVisible(col)}
              onCheckedChange={(value) => toggleColumn(col, !!value)}
              onSelect={(e) => e.preventDefault()}
              className="capitalize"
            >
              {ctx.columnLabels[col] || col}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 供 EntityTable 工具栏渲染，与 DataTable 内列可见性状态同步 */
export function TableViewManagerToolbarSlot({ className }: { className?: string }) {
  const ctx = React.useContext(TableViewManagerBridgeContext)
  if (!ctx) return null
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TableViewManager
        tableName={ctx.tableName}
        currentVisibility={ctx.currentVisibility}
        currentSizing={ctx.currentSizing}
        currentOrder={ctx.currentOrder}
        allColumns={ctx.allColumns}
        columnLabels={ctx.columnLabels}
        onViewChange={ctx.onViewChange}
      />
      <ToolbarColumnVisibilityMenu ctx={ctx} />
    </div>
  )
}
