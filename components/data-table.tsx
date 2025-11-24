"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Columns3 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  // 可排序列配置（如果未指定，则所有列都可排序）
  sortableColumns?: string[]
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
  sortableColumns = [],
}: DataTableProps<TData, TValue>) {
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [pageInputValue, setPageInputValue] = React.useState<string>("")

  // 使用外部分页状态或内部状态
  const currentPage = externalPage !== undefined ? externalPage - 1 : pageIndex
  const currentPageSize = externalPageSize !== undefined ? externalPageSize : pageSize
  const totalRows = total !== undefined ? total : data.length
  
  // 计算总页数（需要在创建 table 之前计算）
  const calculatedPageCount = serverSidePagination && total !== undefined 
    ? Math.ceil(total / currentPageSize)
    : undefined

  const table = useReactTable({
    data,
    columns,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: serverSidePagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: serverSidePagination ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: serverSidePagination,
    manualSorting: serverSidePagination, // 服务器端排序：禁用客户端排序
    pageCount: serverSidePagination ? calculatedPageCount : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: currentPage,
        pageSize: currentPageSize,
      },
    },
  })

  // 处理分页变化
  // 计算实际的总页数
  const pageCount = serverSidePagination && calculatedPageCount !== undefined
    ? calculatedPageCount
    : table.getPageCount()

  // 同步页码输入框的值
  React.useEffect(() => {
    setPageInputValue(String(currentPage + 1))
  }, [currentPage])

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
        </div>
      </div>
      )}

      {/* 表格 */}
      <div className="border-0 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full border-collapse table-auto">
            <TableHeader className="bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-700/80">
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-2 border-border/50 [&_th]:pb-3 [&_th]:pt-3 [&_th]:border-t-0 [&_th]:first:pl-4 [&_th]:last:pr-4">
                  {headerGroup.headers.map((header, headerIndex) => {
                  const canSort = header.column.getCanSort()
                  const columnId = header.column.id
                  const isActionsColumn = columnId === 'actions'
                  const isLastHeader = headerIndex === headerGroup.headers.length - 1
                  
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
                      <TableHead key={header.id} className="font-semibold text-sm text-foreground/90 px-2 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {showColumnToggle && (
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
                                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
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
                          <span>操作</span>
                        </div>
                      </TableHead>
                    )
                  }
                  
                  // 获取列宽样式和对齐方式
                  const widthClass = (header.column.columnDef.meta as any)?.widthClass || ''
                  const alignRight = (header.column.columnDef.meta as any)?.alignRight || false
                  
                  return (
                    <TableHead key={header.id} className={`font-semibold text-sm text-foreground/90 py-3 ${isActionsColumn ? 'px-2' : 'px-3'} ${widthClass} whitespace-nowrap`}>
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center justify-center">
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
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20 transition-all duration-200 border-b border-border/30 group"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isActionsCell = cell.column.id === 'actions'
                    const widthClass = (cell.column.columnDef.meta as any)?.widthClass || ''
                    return (
                      <TableCell key={cell.id} className={`py-3 group-hover:text-foreground transition-colors ${isActionsCell ? 'px-2' : 'px-3'} ${widthClass}`}>
                        <div className="flex justify-center truncate">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                        </div>
                    </TableCell>
                    )
                  })}
                </TableRow>
              ))
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

