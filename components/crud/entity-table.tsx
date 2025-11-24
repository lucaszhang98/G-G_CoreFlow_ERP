/**
 * 通用实体列表组件
 */

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Search } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { createStandardTableConfig } from "@/lib/table/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityConfig, FieldConfig } from "@/lib/crud/types"
import { toast } from "sonner"
import { EntityForm } from "./entity-form"

interface EntityTableProps<T = any> {
  config: EntityConfig
  FormComponent?: React.ComponentType<any>
}

export function EntityTable<T = any>({ config, FormComponent }: EntityTableProps<T>) {
  const router = useRouter()
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)
  const [openDialog, setOpenDialog] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<T | null>(null)
  const [editingItem, setEditingItem] = React.useState<T | null>(null)
  
  // 分页和排序状态
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(config.list.pageSize || 10)
  const [total, setTotal] = React.useState(0)
  const [sort, setSort] = React.useState(config.list.defaultSort)
  const [order, setOrder] = React.useState<'asc' | 'desc'>(config.list.defaultOrder)
  const [sorting, setSorting] = React.useState([{ 
    id: config.list.defaultSort, 
    desc: config.list.defaultOrder === 'desc' 
  }])
  
  // 搜索状态
  const [search, setSearch] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')

  // 获取列表数据
  const fetchData = React.useCallback(async (
    currentPage: number,
    currentPageSize: number,
    currentSort: string,
    currentOrder: 'asc' | 'desc',
    currentSearch: string
  ) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentPageSize),
        sort: currentSort,
        order: currentOrder,
      })
      if (currentSearch) {
        params.append('search', currentSearch)
      }
      
      const apiUrl = `${config.apiPath}?${params.toString()}`
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        let errorMessage = `获取${config.displayName}列表失败`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          if (process.env.NODE_ENV === 'development') {
            console.error(`[EntityTable] API错误 (${response.status}):`, errorData)
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[EntityTable] API错误 (${response.status}):`, response.statusText)
          }
          errorMessage = `HTTP ${response.status}: ${response.statusText || '请求失败'}`
        }
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      
      if (!result || typeof result !== 'object') {
        throw new Error('服务器返回数据格式错误')
      }
      
      setData(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (error: any) {
      console.error(`[EntityTable] 获取${config.displayName}列表失败:`, error)
      const errorMsg = error?.message || `获取${config.displayName}列表失败`
      toast.error(errorMsg)
      // 设置空数据，避免显示旧数据
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [config.apiPath, config.displayName])

  React.useEffect(() => {
    fetchData(page, pageSize, sort, order, search)
  }, [fetchData, page, pageSize, sort, order, search])
  
  // 处理搜索（防抖）
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1) // 搜索时重置到第一页
    }, 300) // 300ms 防抖
    
    return () => clearTimeout(timer)
  }, [searchInput])

  // 处理排序
  const handleSortingChange = (newSorting: Array<{ id: string; desc: boolean }>) => {
    setSorting(newSorting)
    if (newSorting.length > 0) {
      const sortItem = newSorting[0]
      setSort(sortItem.id)
      setOrder(sortItem.desc ? 'desc' : 'asc')
      setPage(1)
    } else {
      setSort(config.list.defaultSort)
      setOrder(config.list.defaultOrder)
      setPage(1)
      setSorting([{ id: config.list.defaultSort, desc: config.list.defaultOrder === 'desc' }])
    }
  }

  // 处理创建
  const handleCreate = () => {
    setEditingItem(null)
    setOpenDialog(true)
  }

  // 获取ID字段名
  const getIdField = () => config.idField || 'id'

  // 处理查看详情
  const handleView = (item: T) => {
    try {
      const idField = getIdField()
      const id = (item as any)[idField]
      if (!id && id !== 0) {
        toast.error('无法获取ID，请刷新页面重试')
        return
      }
      const idString = String(id)
      const detailUrl = `${config.detailPath}/${idString}`
      router.push(detailUrl)
    } catch (error) {
      toast.error('查看详情失败，请刷新页面重试')
    }
  }

  // 处理删除
  const handleDelete = (item: T) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!itemToDelete) return
    
    try {
      const idField = getIdField()
      const id = (itemToDelete as any)[idField]
      const response = await fetch(`${config.apiPath}/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `删除${config.displayName}失败`)
      }
      
      toast.success(`删除${config.displayName}成功`)
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      fetchData(page, pageSize, sort, order, search)
    } catch (error: any) {
      console.error(`删除${config.displayName}失败:`, error)
      toast.error(error.message || `删除${config.displayName}失败`)
    }
  }

  // 表单提交成功回调
  const handleFormSuccess = () => {
    setOpenDialog(false)
    setEditingItem(null)
    fetchData(page, pageSize, sort, order, search)
  }

  // 根据字段类型获取合适的列宽类（参考专业ERP系统标准）
  const getColumnWidthClass = (fieldKey: string, fieldConfig: any): string => {
    // ID列：最窄，通常不显示或隐藏
    if (fieldKey === 'id' && !fieldKey.includes('_id')) {
      return 'w-[80px]'
    }
    
    // 代码列：较窄，专业系统通常80-100px
    if (fieldKey === 'code' || fieldKey.includes('_code')) {
      return 'w-[100px]'
    }
    
    // 状态/Badge列：较窄，专业系统通常80-90px
    if (fieldConfig.type === 'badge') {
      return 'w-[90px]'
    }
    
    // 数字列：中等宽度，专业系统通常100-110px
    if (fieldConfig.type === 'number') {
      // 特殊处理容量等可能较长的数字
      if (fieldKey.includes('capacity') || fieldKey.includes('volume') || fieldKey.includes('weight')) {
        return 'w-[120px]'
      }
      return 'w-[100px]'
    }
    
    // 货币列：中等宽度，专业系统通常110-120px（考虑货币符号和千分位）
    if (fieldConfig.type === 'currency') {
      return 'w-[120px]'
    }
    
    // 日期列：中等宽度，专业系统通常110-120px
    if (fieldConfig.type === 'date') {
      return 'w-[120px]'
    }
    
    // 电话：中等宽度，专业系统通常130-140px
    if (fieldConfig.type === 'phone') {
      return 'w-[140px]'
    }
    
    // 邮箱：较宽，专业系统通常180-200px
    if (fieldConfig.type === 'email') {
      return 'w-[200px]'
    }
    
    // 关系列：根据具体类型设置
    if (fieldConfig.type === 'relation') {
      // 部门、用户等短关系：中等宽度
      if (fieldKey.includes('department') || fieldKey.includes('user') || fieldKey.includes('contact')) {
        return 'w-[130px]'
      }
      // 其他关系：较宽
      return 'w-[160px]'
    }
    
    // 名称列：最宽，专业系统通常200-250px
    if (fieldKey === 'name' || fieldKey === 'full_name' || fieldKey === 'username') {
      return 'min-w-[220px]'
    }
    
    // 公司名称等：较宽
    if (fieldKey.includes('company') || fieldKey.includes('organization')) {
      return 'min-w-[200px]'
    }
    
    // 地址、描述等长文本：较宽
    if (fieldKey.includes('address') || fieldKey.includes('description') || fieldKey.includes('remark')) {
      return 'min-w-[220px]'
    }
    
    // 其他文本列：默认中等宽度
    return 'min-w-[160px]'
  }

  // 生成基础列定义（不包含操作列，操作列由框架自动添加）
  const baseColumns: ColumnDef<T>[] = config.list.columns.map((fieldKey) => {
    const fieldConfig = config.fields[fieldKey]
    if (!fieldConfig) return null

    const column: ColumnDef<T> = {
      accessorKey: fieldKey,
      header: fieldConfig.label,
      enableSorting: fieldConfig.sortable || false,
      enableHiding: true, // 允许隐藏列
      meta: {
        widthClass: getColumnWidthClass(fieldKey, fieldConfig),
        alignRight: fieldConfig.type === 'number' || fieldConfig.type === 'currency',
      },
    }

    // 自定义 cell 渲染（根据字段类型）
    if (fieldConfig.type === 'badge') {
      column.cell = ({ row }) => {
        const value = row.getValue(fieldKey) as string
        return (
          <Badge variant={value === 'active' ? 'default' : 'secondary'}>
            {fieldConfig.options?.find(opt => opt.value === value)?.label || value}
          </Badge>
        )
      }
    } else if (fieldConfig.type === 'currency') {
      column.cell = ({ row }) => {
        const value = row.getValue(fieldKey)
        if (!value && value !== 0) return <div className="text-muted-foreground">-</div>
        const numValue = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(numValue)) return <div className="text-muted-foreground">-</div>
        return (
          <div className="font-medium">
            ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )
      }
    } else if (fieldConfig.type === 'date') {
      column.cell = ({ row }) => {
        const value = row.getValue(fieldKey) as string | null
        return <div>{value ? new Date(value).toLocaleDateString('zh-CN') : '-'}</div>
      }
    } else if (fieldConfig.type === 'relation') {
      column.cell = ({ row }) => {
        const value = row.getValue(fieldKey)
        const displayValue = fieldConfig.relation?.displayField
          ? (value as any)?.[fieldConfig.relation.displayField]
          : value
        return <div>{displayValue || '-'}</div>
      }
    } else if (fieldConfig.type === 'number') {
      column.cell = ({ row }) => {
        const value = row.getValue(fieldKey)
        if (value === null || value === undefined) return <div className="text-muted-foreground">-</div>
        const numValue = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(numValue)) return <div className="text-muted-foreground">-</div>
        // 特殊处理：如果是 capacity_cbm，显示 CBM 单位
        if (fieldKey === 'capacity_cbm') {
          return <div>{numValue.toLocaleString()} CBM</div>
        }
        return <div>{numValue.toLocaleString()}</div>
      }
    }

    return column
  }).filter(Boolean) as ColumnDef<T>[]

  // 使用新框架创建表格配置
  const tableConfig = React.useMemo(() => {
    // 获取可排序列（根据字段配置）
    const sortableColumns = config.list.columns.filter(fieldKey => {
      const fieldConfig = config.fields[fieldKey]
      return fieldConfig?.sortable
    })

    // 创建列标签映射
    const columnLabels = Object.fromEntries(
      config.list.columns.map(fieldKey => {
        const fieldConfig = config.fields[fieldKey]
        return [fieldKey, fieldConfig?.label || fieldKey]
      })
    )

    try {
      return createStandardTableConfig<T>({
        columns: baseColumns,
        sortableColumns,
        columnLabels,
        showActions: true,
        actionsConfig: {
          onView: handleView,
          onDelete: handleDelete,
        },
      })
    } catch (error) {
      console.error('创建表格配置失败:', error)
      // 如果失败，返回基础配置，不包含操作列
      return {
        columns: baseColumns,
        sortableColumns,
        columnLabels,
      }
    }
  }, [baseColumns, config.list.columns, config.fields, handleView, handleDelete])

  const { columns, sortableColumns, columnLabels } = tableConfig

  // 获取搜索占位符（使用第一个可搜索字段）
  const searchPlaceholder = config.list.searchFields && config.list.searchFields.length > 0
    ? `搜索${config.list.searchFields.map(field => config.fields[field]?.label || field).join('、')}...`
    : '搜索...'

  return (
    <div className="space-y-8">
      {/* 页面头部 */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3 flex-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {config.pluralName}管理
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            管理系统中所有{config.pluralName}信息，支持搜索、筛选和批量操作
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button 
            onClick={handleCreate}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 h-11 px-6 text-base font-medium"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            新建{config.displayName}
          </Button>
        </div>
      </div>

      {/* 工具栏卡片 */}
      <Card className="border border-border/50 shadow-md bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* 搜索框 */}
            {config.list.searchFields && config.list.searchFields.length > 0 && (
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-20 h-10 text-sm bg-background border focus:border-blue-500/50 transition-all duration-200"
                />
                {searchInput && (
                  <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
                    <Badge variant="secondary" className="text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 border-0">
                      {total}
                    </Badge>
                  </div>
                )}
              </div>
            )}
            
            {/* 统计信息 */}
            <div className="flex items-center text-sm text-muted-foreground">
              <span>共 <span className="font-semibold text-foreground">{total}</span> 条</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格卡片 */}
      <Card className="border border-border/50 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm overflow-hidden !py-0 !gap-0">
        <CardContent className="!p-0">
          <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(newPageSize) => {
          setPageSize(newPageSize)
          setPage(1)
        }}
        onSortingChange={handleSortingChange}
        serverSidePagination={true}
        initialSorting={sorting}
        showColumnToggle={true}
        columnLabels={columnLabels}
        sortableColumns={sortableColumns}
      />
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {editingItem ? `编辑${config.displayName}` : `新建${config.displayName}`}
            </DialogTitle>
            <DialogDescription className="text-base">
              {editingItem
                ? `修改${config.displayName}信息`
                : `填写${config.displayName}基本信息，创建新${config.displayName}`}
            </DialogDescription>
          </DialogHeader>
          {FormComponent ? (
            <FormComponent
              data={editingItem}
              config={config}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setOpenDialog(false)
                setEditingItem(null)
              }}
            />
          ) : (
            <EntityForm
              data={editingItem}
              config={config}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setOpenDialog(false)
                setEditingItem(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-0 shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-destructive">确认删除</DialogTitle>
            <DialogDescription className="text-base">
              确定要删除{config.displayName} <span className="font-semibold text-foreground">"{itemToDelete ? (itemToDelete as any).name || (itemToDelete as any).code : ''}"</span> 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setItemToDelete(null)
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

