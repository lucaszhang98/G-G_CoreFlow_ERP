"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  ColumnOrderState,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronRight, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Columns3, Copy, Check, GripVertical } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableViewManager } from "@/components/table/table-view-manager"
import { getDefaultView, applyViewToVisibility } from "@/lib/table/view-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  onAdd?: () => void
  addButtonLabel?: string
  initialSorting?: SortingState
  // 分页相关
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  // 排序相关（服务器端排序时使用）
  onSortingChange?: (sorting: SortingState) => void
  // 是否使用服务器端分页
  serverSidePagination?: boolean
  // 加载状态
  loading?: boolean
  // 列显示控制
  showColumnToggle?: boolean
  columnLabels?: Record<string, string> // 列ID到显示标签的映射
  // 视图管理
  enableViewManager?: boolean // 是否启用视图管理
  viewManagerTableName?: string // 视图管理的表名（用于区分不同表格）
  // 可排序列配置（如果未指定，则所有列都可排序）
  sortableColumns?: string[]
  // 行选择相关
  enableRowSelection?: boolean // 是否启用行选择
  onRowSelectionChange?: (selectedRows: TData[]) => void // 行选择变化回调
  getIdValue?: (row: TData) => string | number // 获取行的ID值（用于行选择）
  selectedRows?: TData[] // 外部控制的行选择（受控模式）
  // 行内编辑相关
  isRowEditing?: (row: TData) => boolean // 检查行是否正在编辑
  onCancelEdit?: () => void // 取消编辑回调（当点击其他行时调用）
  // 可展开行相关
  expandableRows?: {
    enabled: boolean
    getExpandedContent?: (row: TData) => React.ReactNode | null // 获取展开内容
  }
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "搜索...",
  onAdd,
  addButtonLabel = "新建",
  initialSorting = [],
  total,
  page: externalPage,
  pageSize: externalPageSize,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  serverSidePagination = false,
  loading = false,
  showColumnToggle = false,
  columnLabels = {},
  enableViewManager = false,
  viewManagerTableName,
  sortableColumns = [],
  enableRowSelection = false,
  onRowSelectionChange,
  getIdValue,
  selectedRows: externalSelectedRows,
  isRowEditing,
  onCancelEdit,
  expandableRows,
}: DataTableProps<TData, TValue>) {
  // 防止 hydration 错误：只在客户端渲染 DropdownMenu
  const [mounted, setMounted] = React.useState(false)
  // 展开行状态
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  // 复制状态（用于显示复制成功提示）
  const [copiedCellId, setCopiedCellId] = React.useState<string | null>(null)
  // 拖拽状态
  const [draggedColumn, setDraggedColumn] = React.useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = React.useState<string | null>(null)
  // Resize 状态（用于禁用拖拽）
  const [isResizing, setIsResizing] = React.useState(false)
  
  // 拖拽滚动状态
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [isDraggingScroll, setIsDraggingScroll] = React.useState(false)
  const isDraggingScrollRef = React.useRef(false)
  const scrollStartRef = React.useRef({ x: 0, scrollLeft: 0, hasMoved: false })
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 全局监听 mouseup 事件，确保 resize 结束时重置状态
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isResizing) {
        setIsResizing(false)
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('touchend', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('touchend', handleGlobalMouseUp)
    }
  }, [isResizing])

  // 拖拽滚动处理函数
  const handleScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 只响应左键，右键留给右键菜单
    if (e.button !== 0) return
    
    const container = scrollContainerRef.current
    if (!container) return
    
    // 检查是否点击在交互元素上（按钮、输入框、链接、复选框等）
    const target = e.target as HTMLElement
    const isInteractiveElement = 
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[role="button"]') ||
      target.closest('[role="checkbox"]') ||
      target.closest('.resize-handle') || // 排除调整列宽的手柄
      target.classList.contains('resize-handle')
    
    if (isInteractiveElement) return
    
    // 记录初始位置
    scrollStartRef.current = {
      x: e.clientX,
      scrollLeft: container.scrollLeft,
      hasMoved: false
    }
    
    isDraggingScrollRef.current = true
  }

  // 使用全局监听器处理鼠标移动和释放
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingScrollRef.current) return
      
      const container = scrollContainerRef.current
      if (!container) return
      
      const dx = e.clientX - scrollStartRef.current.x
      const distance = Math.abs(dx)
      
      // 移动超过3px才算拖拽（降低阈值）
      if (distance > 3) {
        if (!scrollStartRef.current.hasMoved) {
          scrollStartRef.current.hasMoved = true
          setIsDraggingScroll(true)
        }
        
        container.scrollLeft = scrollStartRef.current.scrollLeft - dx
        e.preventDefault()
      }
    }
    
    const handleGlobalMouseUp = () => {
      if (isDraggingScrollRef.current) {
        isDraggingScrollRef.current = false
        setIsDraggingScroll(false)
        scrollStartRef.current = { x: 0, scrollLeft: 0, hasMoved: false }
      }
    }
    
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)

  // 同步初始排序状态（只在真正改变时更新，避免无限循环）
  const initialSortingRef = React.useRef(initialSorting)
  React.useEffect(() => {
    // 深度比较 initialSorting 是否真的改变了
    const hasChanged = JSON.stringify(initialSortingRef.current) !== JSON.stringify(initialSorting)
    if (hasChanged) {
      initialSortingRef.current = initialSorting
      setSorting(initialSorting)
    }
  }, [initialSorting])

  // 处理排序状态变化
  const handleSortingChange = (updater: any) => {
    const newSorting = typeof updater === 'function' ? updater(sorting) : updater
    setSorting(newSorting)
    if (onSortingChange) {
      onSortingChange(newSorting)
    }
  }
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  
  // 视图管理：初始化列可见性（根据保存的视图）
  // 初始状态为空对象，等待 table 初始化后再应用默认视图
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
  
  const [rowSelection, setRowSelection] = React.useState({})
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [pageInputValue, setPageInputValue] = React.useState<string>("")

  // 同步外部控制的行选择状态
  React.useEffect(() => {
    if (externalSelectedRows !== undefined && getIdValue) {
      const newSelection: Record<string, boolean> = {}
      externalSelectedRows.forEach(row => {
        const id = String(getIdValue(row))
        newSelection[id] = true
      })
      setRowSelection(newSelection)
    }
  }, [externalSelectedRows, getIdValue])

  // 使用外部分页状态或内部状态
  const currentPage = externalPage !== undefined ? externalPage - 1 : pageIndex
  const currentPageSize = externalPageSize !== undefined ? externalPageSize : pageSize
  const totalRows = total !== undefined ? total : data.length
  
  // 计算总页数（需要在创建 table 之前计算）
  const calculatedPageCount = serverSidePagination && total !== undefined 
    ? Math.ceil(total / currentPageSize)
    : undefined

  // 如果启用行选择，在列前面添加复选框列
  const finalColumns = React.useMemo(() => {
    if (!enableRowSelection) {
      return columns
    }

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => {
        const isAllSelected = table.getIsAllPageRowsSelected()
        const isSomeSelected = table.getIsSomePageRowsSelected()
        
        // 专业系统的逻辑：
        // - 全部选中：显示为选中状态
        // - 部分选中：显示为半选状态（indeterminate）
        // - 未选中：显示为未选中状态
        const checkedState = isAllSelected 
          ? true 
          : isSomeSelected 
          ? "indeterminate" 
          : false
        
        return (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={checkedState}
              onCheckedChange={(value: boolean) => {
                // 如果有行正在编辑，先取消编辑（专业系统的做法）
                if (isRowEditing && onCancelEdit) {
                  const hasAnyRowEditing = table.getRowModel().rows.some(r => isRowEditing(r.original))
                  if (hasAnyRowEditing) {
                    onCancelEdit()
                    // 使用 setTimeout 确保取消编辑的状态更新完成后再执行全选
                    setTimeout(() => {
                      table.toggleAllPageRowsSelected(!!value)
                    }, 10)
                    return
                  }
                }
                table.toggleAllPageRowsSelected(!!value)
              }}
              aria-label="选择全部"
            />
          </div>
        )
      },
      cell: ({ row, table }) => {
        return (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value: boolean) => {
                // 检查是否有任何行正在编辑（包括当前行）
                let hasAnyRowEditing = false
                if (isRowEditing) {
                  hasAnyRowEditing = table.getRowModel().rows.some(r => isRowEditing(r.original))
                }
                
                // 如果有行正在编辑，先取消编辑，然后延迟执行选择（避免状态冲突）
                if (hasAnyRowEditing && onCancelEdit) {
                  onCancelEdit()
                  // 使用 setTimeout 确保取消编辑的状态更新完成后再执行选择
                  setTimeout(() => {
                    row.toggleSelected(!!value)
                  }, 10)
                } else {
                  // 没有行在编辑，直接执行选择
                  row.toggleSelected(!!value)
                }
              }}
              aria-label="选择行"
            />
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        widthClass: 'w-[60px]',
        alignRight: false,
      },
    }

    return [selectColumn, ...columns]
  }, [enableRowSelection, columns, isRowEditing, getIdValue, onCancelEdit])

  // 行选择变化处理
  const handleRowSelectionChange = React.useCallback((updater: any) => {
    const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater
    setRowSelection(newSelection)
    
    // 通知外部行选择变化
    if (onRowSelectionChange && getIdValue) {
      const selectedRows = Object.keys(newSelection)
        .filter(key => newSelection[key])
        .map(key => data.find(row => String(getIdValue(row)) === key))
        .filter(Boolean) as TData[]
      onRowSelectionChange(selectedRows)
    }
  }, [rowSelection, onRowSelectionChange, getIdValue, data])

  const table = useReactTable({
    data,
    columns: finalColumns,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: serverSidePagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: serverSidePagination ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: enableRowSelection ? handleRowSelectionChange : undefined,
    enableRowSelection: enableRowSelection,
    getRowId: enableRowSelection && getIdValue ? (row) => String(getIdValue(row)) : undefined,
    manualPagination: serverSidePagination,
    manualSorting: serverSidePagination, // 服务器端排序：禁用客户端排序
    pageCount: serverSidePagination ? calculatedPageCount : undefined,
    // 启用列宽调整和列排序
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    defaultColumn: {
      size: 150, // 默认列宽
      minSize: 50, // 最小列宽
      maxSize: 800, // 最大列宽
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnOrder,
      rowSelection: enableRowSelection ? rowSelection : {},
      pagination: {
        pageIndex: currentPage,
        pageSize: currentPageSize,
      },
    },
  })

  // 当 table 初始化后，应用默认视图（确保列ID都正确）
  // 这个 useEffect 必须在 table 创建之后
  React.useEffect(() => {
    if (enableViewManager && viewManagerTableName && table) {
      // 使用 table.getAllColumns() 获取所有列（包括隐藏的列）
      const allColumns = table.getAllColumns()
      const allColumnIds = allColumns
        .map(col => col.id)
        .filter((id): id is string => !!id && id !== 'select') // 排除 select 列
      
      if (allColumnIds.length > 0) {
        // 异步加载默认视图
        const loadDefaultView = async () => {
          try {
            const defaultView = await getDefaultView(viewManagerTableName)
            if (defaultView) {
              const initialVisibility = applyViewToVisibility(defaultView, allColumnIds)
              setColumnVisibility(initialVisibility)
              // 应用保存的列宽和列顺序
              if (defaultView.columnSizing) {
                setColumnSizing(defaultView.columnSizing)
              }
              if (defaultView.columnOrder && defaultView.columnOrder.length > 0) {
                setColumnOrder(defaultView.columnOrder)
              }
            }
          } catch (error) {
            console.error('加载默认视图失败:', error)
          }
        }
        loadDefaultView()
      }
    }
  }, [enableViewManager, viewManagerTableName, table])

  // 处理分页变化
  // 计算实际的总页数
  const pageCount = serverSidePagination && calculatedPageCount !== undefined
    ? calculatedPageCount
    : table.getPageCount()

  // 同步页码输入框的值
  React.useEffect(() => {
    setPageInputValue(String(currentPage + 1))
  }, [currentPage])

  // 计算当前列可见性状态（用于保存视图）
  const currentColumnVisibility = React.useMemo(() => {
    if (!enableViewManager || !viewManagerTableName) {
      return {}
    }
    
    // 从表格中获取当前实际的列可见性状态（用于保存视图）
    // 使用 table.getAllColumns() 获取所有列（包括隐藏的列），而不是 finalColumns
    const actualVisibility: Record<string, boolean> = {}
    
    // 获取所有列（包括隐藏的列）
    const allColumns = table.getAllColumns()
    const allColumnIds = allColumns
      .map(col => col.id)
      .filter((id): id is string => !!id && id !== 'select') // 排除 select 列，因为它不应该被保存到视图中
    
    allColumnIds.forEach(colId => {
      try {
        const column = table.getColumn(colId)
        if (column) {
          actualVisibility[colId] = column.getIsVisible()
        } else {
          // 如果列还不存在，使用 columnVisibility 状态
          // react-table: false 表示隐藏，true 或不设置表示显示
          actualVisibility[colId] = columnVisibility[colId] !== false
        }
      } catch (error) {
        // 如果获取列失败，使用 columnVisibility 状态
        actualVisibility[colId] = columnVisibility[colId] !== false
      }
    })
    
    return actualVisibility
  }, [enableViewManager, viewManagerTableName, table, columnVisibility])

  const handlePageChange = (newPage: number) => {
    if (serverSidePagination && onPageChange) {
      onPageChange(newPage + 1) // 转换为1-based
    } else {
      setPageIndex(newPage)
      table.setPageIndex(newPage)
    }
  }

  // 处理页码输入框的跳转
  const handlePageInputChange = (value: string) => {
    setPageInputValue(value)
  }

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInputValue)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pageCount) {
      handlePageChange(pageNum - 1)
    } else {
      // 如果输入无效，恢复为当前页码
      setPageInputValue(String(currentPage + 1))
    }
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handlePageInputSubmit()
      e.currentTarget.blur() // 失去焦点
    }
  }

  const handlePageInputBlur = () => {
    handlePageInputSubmit()
  }

  const handlePageSizeChange = (newPageSize: number) => {
    if (serverSidePagination && onPageSizeChange) {
      onPageSizeChange(newPageSize)
    } else {
      setPageSize(newPageSize)
      table.setPageSize(newPageSize)
    }
    // 改变每页条数时重置到第一页
    handlePageChange(0)
  }

  // 列拖拽处理函数
  const handleDragStart = React.useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = React.useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }, [])

  const handleDragLeave = React.useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = React.useCallback((e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // 获取当前列顺序
    const currentOrder = table.getState().columnOrder
    const allColumns = table.getAllLeafColumns().map(col => col.id)
    
    // 如果当前没有设置列顺序，使用默认顺序
    const orderToUse = currentOrder.length > 0 ? currentOrder : allColumns
    
    // 找到拖拽列和目标列的索引
    const draggedIndex = orderToUse.indexOf(draggedColumn)
    const targetIndex = orderToUse.indexOf(targetColumnId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }
    
    // 创建新的列顺序
    const newOrder = [...orderToUse]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)
    
    // 更新列顺序
    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setDragOverColumn(null)
    
    toast.success('列顺序已更新')
  }, [draggedColumn, table])

  const handleDragEnd = React.useCallback(() => {
    setDraggedColumn(null)
    setDragOverColumn(null)
  }, [])

  return (
    <div className="w-full space-y-4">
      {/* 工具栏 - 已移到 EntityTable 中，这里不再显示 */}
      {false && (
      <div className="flex items-center justify-between">
        {searchKey && (
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder={searchPlaceholder}
                value={(table.getColumn(searchKey || '')?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                  table.getColumn(searchKey || '')?.setFilterValue(event.target.value)
              }
              className="h-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {onAdd && (
            <Button onClick={onAdd} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              {addButtonLabel}
            </Button>
          )}
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  列 <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>切换列</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" className="ml-auto" disabled>
              列 <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      )}

      {/* 表格 */}
      <div className="border-0 bg-card overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className={cn(
            "overflow-x-auto scroll-container",
            isDraggingScroll && "dragging-scroll"
          )}
          onMouseDown={handleScrollMouseDown}
        >
          <Table 
            className="border-collapse sticky-table"
            style={{ 
              width: table.getCenterTotalSize(),
              minWidth: '100%' // 保证最小宽度为100%，防止右侧空白
            }}
          >
            <TableHeader className="bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-700/80">
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-2 border-border/50 [&_th]:pb-3 [&_th]:pt-3 [&_th]:border-t-0 [&_th]:first:pl-4 [&_th]:last:pr-4">
                  {/* 展开图标列占位（如果启用展开行功能） */}
                  {expandableRows?.enabled && (
                    <TableHead className="w-[40px] px-2 py-3 text-center">
                      {/* 占位，保持对齐 */}
                    </TableHead>
                  )}
                  {headerGroup.headers.map((header, headerIndex) => {
                  const canSort = header.column.getCanSort()
                  const columnId = header.column.id
                  const isActionsColumn = columnId === 'actions'
                  const isSelectColumn = columnId === 'select'
                  const isLastHeader = headerIndex === headerGroup.headers.length - 1
                  
                  // 确定哪些列需要固定（只固定复选框列和操作列）
                  const shouldSticky = isSelectColumn || isActionsColumn
                  const stickyPosition = isSelectColumn 
                    ? 'left' 
                    : isActionsColumn 
                    ? 'right' 
                    : null
                  
                  // 检查该列是否可以排序（根据 sortableColumns 配置）
                  const canSortColumn = sortableColumns.length === 0 || sortableColumns.includes(columnId)
                  const actualCanSort = canSort && canSortColumn && !isActionsColumn
                  
                  // 获取当前列的排序状态（服务器端排序时从 sorting 状态获取）
                  let sortStatus: 'asc' | 'desc' | false = false
                  if (serverSidePagination) {
                    const currentSort = sorting.find(s => s.id === columnId)
                    if (currentSort) {
                      sortStatus = currentSort.desc ? 'desc' : 'asc'
                    }
                  } else {
                    // 客户端排序：使用 TanStack Table 的状态
                    const isSorted = header.column.getIsSorted()
                    sortStatus = isSorted === 'asc' ? 'asc' : isSorted === 'desc' ? 'desc' : false
                  }
                  
                  // 处理排序点击（服务器端排序时手动处理）
                  const handleSortClick = () => {
                    if (!actualCanSort) return
                    
                    if (serverSidePagination) {
                      // 服务器端排序：手动切换排序状态
                      const currentSort = sorting.find(s => s.id === columnId)
                      
                      let newSorting: SortingState
                      if (!currentSort) {
                        // 未排序 -> 升序
                        newSorting = [{ id: columnId, desc: false }]
                      } else if (!currentSort.desc) {
                        // 升序 -> 降序
                        newSorting = [{ id: columnId, desc: true }]
                      } else {
                        // 降序 -> 未排序（重置为默认排序）
                        newSorting = []
                      }
                      
                      handleSortingChange(newSorting)
                    } else {
                      // 客户端排序：使用默认 handler
                      const handler = header.column.getToggleSortingHandler()
                      if (handler) {
                        handler({} as React.MouseEvent)
                      }
                    }
                  }
                  
                  // 如果是操作列，在表头显示列切换按钮和"操作"标题
                  if (isActionsColumn) {
                    return (
                      <TableHead 
                        key={header.id} 
                        className={cn(
                          "font-semibold text-sm text-foreground/90 px-2 py-3 whitespace-nowrap relative",
                          shouldSticky && stickyPosition === 'right' && "sticky right-0 z-20 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50/95 dark:via-gray-800/95 dark:to-gray-800/95"
                        )}
                        style={shouldSticky && stickyPosition === 'right' ? { 
                          boxShadow: '-2px 0 4px -2px rgba(0, 0, 0, 0.1)' 
                        } : undefined}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {showColumnToggle && mounted && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent">
                                  <Columns3 className="h-4 w-4" />
                                  <span className="sr-only">切换列</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent 
                                align="end" 
                                className="w-56 max-h-[400px] overflow-hidden"
                              >
                                <DropdownMenuLabel className="sticky top-0 bg-popover z-10 py-2 border-b">切换列显示</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {enableViewManager && viewManagerTableName && (
                                  <>
                                    <div className="px-2 py-1.5 border-b">
                                      <TableViewManager
                                        tableName={viewManagerTableName}
                                        currentVisibility={currentColumnVisibility}
                                        currentSizing={columnSizing}
                                        currentOrder={columnOrder}
                                        allColumns={(() => {
                                          // 获取所有列ID（排除 select 列）
                                          const allColumns = table.getAllColumns()
                                          return allColumns
                                            .map(col => col.id)
                                            .filter((id): id is string => !!id && id !== 'select')
                                        })()}
                                        columnLabels={columnLabels}
                                        onViewChange={(visibility, sizing, order) => {
                                          // 直接更新列可见性、列宽和列顺序状态，react-table 会自动应用
                                          setColumnVisibility(visibility)
                                          if (sizing) setColumnSizing(sizing)
                                          if (order) setColumnOrder(order)
                                        }}
                                      />
                                    </div>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <div className="max-h-[320px] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
                                  {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide() && column.id !== 'actions')
                                    .map((column) => {
                                      const colId = column.id
                                      const colLabel = columnLabels[colId] || colId
                                      return (
                                        <DropdownMenuCheckboxItem
                                          key={colId}
                                          checked={column.getIsVisible()}
                                          onCheckedChange={(value) => {
                                            // 阻止事件冒泡，防止页面刷新
                                            const newValue = !!value
                                            // 直接更新列可见性（不触发页面刷新）
                                            column.toggleVisibility(newValue)
                                            // 同步到视图管理器状态（但不保存，只有点击保存视图时才保存）
                                            if (enableViewManager) {
                                              setColumnVisibility(prev => ({
                                                ...prev,
                                                [colId]: newValue
                                              }))
                                            }
                                          }}
                                          onSelect={(e) => {
                                            // 阻止默认选择行为，防止下拉菜单关闭
                                            e.preventDefault()
                                          }}
                                          className="capitalize"
                                        >
                                          {colLabel}
                                        </DropdownMenuCheckboxItem>
                                      )
                                    })}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {showColumnToggle && !mounted && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                              <Columns3 className="h-4 w-4" />
                              <span className="sr-only">切换列</span>
                            </Button>
                          )}
                          <span>操作</span>
                        </div>
                      </TableHead>
                    )
                  }
                  
                  // 获取列宽样式和对齐方式
                  const widthClass = (header.column.columnDef.meta as any)?.widthClass || ''
                  const alignRight = (header.column.columnDef.meta as any)?.alignRight || false
                  
                  // 判断是否可以拖拽（复选框列和操作列不可拖拽，正在resize时也不可拖拽）
                  const isDraggable = !isSelectColumn && !isActionsColumn && !isResizing
                  const isDragging = draggedColumn === columnId
                  const isDragOver = dragOverColumn === columnId
                  
                  return (
                    <TableHead 
                      key={header.id} 
                      className={cn(
                        "font-semibold text-sm text-foreground/90 py-3 relative group",
                        isActionsColumn ? 'px-2' : 'px-3',
                        widthClass,
                        "whitespace-nowrap",
                        shouldSticky && stickyPosition === 'left' && "sticky z-20",
                        isSelectColumn && "left-0 bg-gradient-to-r from-gray-50/95 via-gray-50/95 to-transparent dark:from-gray-800/95 dark:via-gray-800/95",
                        isDragging && "opacity-50",
                        isDragOver && "bg-blue-100 dark:bg-blue-900/30"
                      )}
                      style={{
                        ...(shouldSticky && stickyPosition === 'left' ? { 
                          left: 0,
                          boxShadow: '2px 0 4px -2px rgba(0, 0, 0, 0.1)'
                        } : {}),
                        width: header.getSize(),
                      }}
                      draggable={isDraggable}
                      onDragStart={isDraggable ? (e) => handleDragStart(e, columnId) : undefined}
                      onDragOver={isDraggable ? (e) => handleDragOver(e, columnId) : undefined}
                      onDragLeave={isDraggable ? handleDragLeave : undefined}
                      onDrop={isDraggable ? (e) => handleDrop(e, columnId) : undefined}
                      onDragEnd={isDraggable ? handleDragEnd : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center justify-center">
                          {/* 拖拽手柄 - 只在未resize时显示 */}
                          {isDraggable && !isResizing && (
                            <div 
                              className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
                              onMouseDown={(e) => {
                                // 确保拖拽手柄可以触发拖拽
                                e.stopPropagation()
                              }}
                              title="拖动改变列顺序"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 justify-center">
                            <span className="truncate">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            </span>
                            {actualCanSort && (
                              <button
                                onClick={handleSortClick}
                                className="flex-shrink-0 p-0.5 hover:bg-accent rounded transition-all duration-200 hover:scale-110 cursor-pointer select-none"
                                aria-label="排序"
                              >
                                {sortStatus === 'asc' ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                ) : sortStatus === 'desc' ? (
                                  <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-70" />
                                )}
                              </button>
                            )}
                          </div>
                          
                          {/* Resize Handle - 更宽的可点击区域 */}
                          {!isSelectColumn && !isActionsColumn && (
                            <div
                              onMouseDown={(e) => {
                                e.stopPropagation() // 阻止拖拽事件
                                e.preventDefault() // 防止文本选择
                                setIsResizing(true)
                                
                                // 调用 TanStack Table 的 resize handler
                                const resizeHandler = header.getResizeHandler()
                                if (resizeHandler) {
                                  resizeHandler(e)
                                }
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                                setIsResizing(true)
                                
                                const resizeHandler = header.getResizeHandler()
                                if (resizeHandler) {
                                  resizeHandler(e)
                                }
                              }}
                              className={cn(
                                "absolute right-0 top-0 h-full w-3 cursor-col-resize select-none touch-none z-30",
                                "flex items-center justify-center",
                                "opacity-0 group-hover:opacity-100 transition-opacity",
                                header.column.getIsResizing() && "opacity-100"
                              )}
                              title="拖动调整列宽"
                            >
                              {/* 视觉指示器 */}
                              <div className={cn(
                                "w-0.5 h-full rounded-full transition-colors pointer-events-none",
                                header.column.getIsResizing() 
                                  ? "bg-blue-600" 
                                  : "bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 dark:hover:bg-blue-500"
                              )} />
                            </div>
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              // 加载中状态
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center py-8"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">加载中...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => {
                // 只在客户端检查编辑状态，避免 hydration 错误
                const isEditing = typeof window !== 'undefined' && (isRowEditing?.(row.original) || false)
                const isSelected = row.getIsSelected()
                const rowId = String(row.id)
                const isExpanded = expandableRows?.enabled && expandedRows.has(rowId)
                // 先检查是否有展开内容，避免不必要的渲染
                const expandedContent = expandableRows?.enabled && expandableRows?.getExpandedContent 
                  ? expandableRows.getExpandedContent(row.original)
                  : null
                const canExpand = expandableRows?.enabled && expandedContent !== null
                
                // 如果已展开，获取展开内容（用于渲染）
                const currentExpandedContent = isExpanded && expandedContent ? expandedContent : null
                
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      data-state={(isSelected && "selected") || (isEditing && "editing")}
                      suppressHydrationWarning={isEditing} // 编辑状态可能在服务器端和客户端不一致
                      className={cn(
                        "transition-all duration-200 border-b border-border/30 group cursor-pointer",
                        isEditing
                          ? "bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/40 shadow-md shadow-amber-500/20 border-amber-300 dark:border-amber-700"
                          : isSelected
                          ? "bg-gradient-to-r from-blue-50 via-indigo-50/80 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 shadow-sm shadow-blue-500/10"
                          : "hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20"
                      )}
                      onClick={(e) => {
                        // 完全禁用行点击展开，只允许通过展开图标展开
                        // 这样可以避免在编辑单元格时误触发展开
                        e.stopPropagation()
                      }}
                    >
                      {/* 展开图标列（如果启用展开行功能，始终显示以保持对齐） */}
                      {expandableRows?.enabled && (
                        <TableCell className="py-3 px-2 w-[40px] text-center">
                          {canExpand ? (
                            <div 
                              data-expand-trigger
                              className="flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                const newExpanded = new Set(expandedRows)
                                if (newExpanded.has(rowId)) {
                                  newExpanded.delete(rowId)
                                } else {
                                  newExpanded.add(rowId)
                                }
                                setExpandedRows(newExpanded)
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            <div className="w-4" /> // 占位，保持对齐
                          )}
                        </TableCell>
                      )}
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const isActionsCell = cell.column.id === 'actions'
                        const isSelectCell = cell.column.id === 'select'
                        const widthClass = (cell.column.columnDef.meta as any)?.widthClass || ''
                        
                        // 确定哪些单元格需要固定（只固定复选框列和操作列）
                        const shouldSticky = isSelectCell || isActionsCell
                        const stickyPosition = isSelectCell 
                          ? 'left' 
                          : isActionsCell 
                          ? 'right' 
                          : null
                        
                        // 提取单元格文本内容用于复制
                        const extractCellText = (): string => {
                          // 如果是操作列或复选框列，不复制
                          if (isActionsCell || isSelectCell) {
                            return ''
                          }
                          
                          // 尝试从 cell 的原始值获取文本
                          const cellValue = cell.getValue()
                          if (cellValue !== null && cellValue !== undefined) {
                            // 处理不同类型的值
                            if (typeof cellValue === 'object') {
                              // 如果是对象，尝试获取显示文本
                              if ('name' in cellValue) {
                                return String(cellValue.name)
                              }
                              if ('label' in cellValue) {
                                return String(cellValue.label)
                              }
                              return JSON.stringify(cellValue)
                            }
                            return String(cellValue)
                          }
                          
                          return ''
                        }
                        
                        // 处理右键复制
                        const handleContextMenu = async (e: React.MouseEvent<HTMLTableCellElement>) => {
                          // 如果是操作列或复选框列，不显示复制菜单
                          if (isActionsCell || isSelectCell) {
                            return
                          }
                          
                          // 如果行正在编辑，不处理右键复制（让浏览器默认行为处理）
                          if (isEditing) {
                            return
                          }
                          
                          // 如果点击的是可编辑元素，不处理
                          if (e.target instanceof HTMLElement) {
                            const target = e.target as HTMLElement
                            if (target.closest('.inline-edit-cell') || 
                                target.closest('input') || 
                                target.closest('textarea') || 
                                target.closest('select') ||
                                target.closest('[contenteditable="true"]')) {
                              return
                            }
                          }
                          
                          e.preventDefault()
                          
                          const textToCopy = extractCellText()
                          
                          if (!textToCopy) {
                            return
                          }
                          
                          try {
                            // 使用 Clipboard API（与测试页面相同的方法）
                            await navigator.clipboard.writeText(textToCopy)
                            
                            setCopiedCellId(cell.id)
                            toast.success('已复制到剪贴板', {
                              duration: 1500,
                            })
                            
                            setTimeout(() => {
                              setCopiedCellId(null)
                            }, 1500)
                          } catch (error) {
                            console.error('复制失败:', error)
                            toast.error('复制失败，请手动选择文本复制')
                          }
                        }
                        
                        const isCopied = copiedCellId === cell.id
                        
                        // 确定 cursor 样式：编辑状态下不显示 context-menu
                        // 只有在非编辑状态、非操作列、非复选框列时才显示右键菜单图标
                        const shouldShowContextMenu = !isActionsCell && !isSelectCell && !isEditing
                        
                        return (
                          <TableCell 
                            key={cell.id} 
                            className={cn(
                              "py-3 group-hover:text-foreground transition-colors relative",
                              isActionsCell ? 'px-2' : 'px-3',
                              widthClass,
                              shouldSticky && stickyPosition === 'left' && "sticky z-10 left-0",
                              shouldSticky && stickyPosition === 'right' && "sticky right-0 z-10",
                              shouldShowContextMenu && "cursor-context-menu",
                              isCopied && "bg-green-50 dark:bg-green-950/20"
                            )}
                            style={{
                              width: cell.column.getSize(),
                              ...(shouldSticky ? { 
                                left: stickyPosition === 'left' ? 0 : undefined,
                                right: stickyPosition === 'right' ? 0 : undefined,
                                backgroundColor: shouldSticky ? 'var(--background)' : undefined,
                                boxShadow: shouldSticky 
                                  ? (stickyPosition === 'left' 
                                    ? '2px 0 4px -2px rgba(0, 0, 0, 0.1)' 
                                    : '-2px 0 4px -2px rgba(0, 0, 0, 0.1)')
                                  : undefined
                              } : {})
                            }}
                            onContextMenu={handleContextMenu}
                            onClick={(e) => {
                              // 如果点击的是可编辑单元格，阻止事件冒泡到行
                              if (e.target instanceof HTMLElement) {
                                const target = e.target as HTMLElement
                                if (target.closest('.inline-edit-cell') || 
                                    target.closest('input') || 
                                    target.closest('textarea') || 
                                    target.closest('select') ||
                                    target.closest('[contenteditable="true"]')) {
                                  e.stopPropagation()
                                }
                              }
                            }}
                            data-tooltip={!isActionsCell && !isSelectCell && !isEditing ? '右键点击复制' : undefined}
                          >
                            <div className={cn(
                              "flex justify-center truncate relative",
                              shouldShowContextMenu && "cursor-context-menu"
                            )}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                              {isCopied && (
                                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 animate-in fade-in zoom-in duration-200">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                        </TableCell>
                        )
                      })}
                    </TableRow>
                    {isExpanded && currentExpandedContent && (
                      <TableRow>
                        <TableCell colSpan={row.getVisibleCells().length + (expandableRows?.enabled ? 1 : 0)} className="p-0 bg-muted/30">
                          {currentExpandedContent}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              // 暂无数据状态
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center py-8"
                >
                  <span className="text-muted-foreground">暂无数据</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* 分页 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 py-3 border-t border-border/50 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50 !mt-0">
        <div className="flex-1 text-sm text-muted-foreground">
          {serverSidePagination && total !== undefined ? (
            <span className="flex items-center gap-1">
              显示第 <span className="font-medium text-foreground">{currentPage * currentPageSize + 1}</span> - <span className="font-medium text-foreground">{Math.min((currentPage + 1) * currentPageSize, total)}</span> 条，
              共 <span className="font-medium text-foreground">{total}</span> 条记录
            </span>
          ) : (
            <>显示 {table.getFilteredRowModel().rows.length} 条记录</>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* 每页选择 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">每页</span>
            <select
              value={currentPageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-9 w-[80px] rounded-md border-2 border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iNiIgdmlld0JveD0iMCAwIDEwIDYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNSA1TDkgMSIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPg==')] bg-[length:10px_6px] bg-[right_10px_center] bg-no-repeat"
            >
              {[10, 20, 30, 40, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* 页码导航 */}
          <div className="flex items-center gap-2">
            {/* 上一页 */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border-2 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-200 disabled:opacity-40"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <span className="sr-only">上一页</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>

            {/* 页码输入 */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={pageInputValue}
                onChange={(e) => handlePageInputChange(e.target.value)}
                onKeyDown={handlePageInputKeyDown}
                onBlur={handlePageInputBlur}
                className="h-8 w-[36px] rounded-md border border-input bg-background px-1 text-center text-sm text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">/ {pageCount}</span>
            </div>

            {/* 下一页 */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border-2 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-200 disabled:opacity-40"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
            >
              <span className="sr-only">下一页</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

