"use client"

import * as React from "react"
import { DataTable } from "@/components/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { SearchModule } from "@/components/crud/search-module"
import { FilterFieldConfig, AdvancedSearchFieldConfig } from "@/lib/crud/types"
import { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface OperationsTrackingItem {
  order_id: string
  container_number: string
  port_code: string | null
  carrier_name: string | null
  eta_date: string | null
  lfd_date: string | null
  pickup_date: string | null
  unload_date: string | null
  return_deadline: string | null
  pickup_lead_time: number | null
  unload_lead_time: number | null
  chassis_days: number | null
  details: Array<{
    id: string
    order_id: string | null
    location_code: string | null
    unload_pallets: number | null
    remaining_pallets: number | null
    window_period: string | null
    isa: string | null
    notes: string | null
    delivery_date: string | null
    delivery_lead_time: number | null
  }>
}

interface OperationsTrackingClientProps {
  operationMode: 'unload' | 'delivery' // 'delivery' 会在 API 中转换为 'direct_delivery'
  title: string
}

export function OperationsTrackingClient({ operationMode, title }: OperationsTrackingClientProps) {
  const [data, setData] = React.useState<OperationsTrackingItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  
  // 筛选状态
  const [filterValues, setFilterValues] = React.useState<Record<string, any>>({})
  
  // 高级搜索状态
  const [advancedSearchOpen, setAdvancedSearchOpen] = React.useState(false)
  const [advancedSearchValues, setAdvancedSearchValues] = React.useState<Record<string, any>>({})
  const [advancedSearchLogic, setAdvancedSearchLogic] = React.useState<'AND' | 'OR'>('AND')

  // 定义筛选字段配置
  const filterFields: FilterFieldConfig[] = React.useMemo(() => [
    {
      field: 'carrier_id',
      label: '承运公司',
      type: 'select',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
    },
    {
      field: 'port_location_id',
      label: '码头',
      type: 'select',
      relation: {
        model: 'locations',
        displayField: 'location_code',
        valueField: 'location_id',
      },
    },
    {
      field: 'eta_date',
      label: 'ETA日期',
      type: 'dateRange',
      dateFields: ['eta_date'],
    },
    {
      field: 'pickup_date',
      label: '提柜日期',
      type: 'dateRange',
      dateFields: ['pickup_date'],
    },
  ], [])

  // 定义高级搜索字段配置
  const advancedSearchFields: AdvancedSearchFieldConfig[] = React.useMemo(() => [
    {
      field: 'container_number',
      label: '柜号',
      type: 'text',
    },
    {
      field: 'carrier_id',
      label: '承运公司',
      type: 'select',
      relation: {
        model: 'carriers',
        displayField: 'name',
        valueField: 'carrier_id',
      },
    },
    {
      field: 'port_location_id',
      label: '码头',
      type: 'select',
      relation: {
        model: 'locations',
        displayField: 'location_code',
        valueField: 'location_id',
      },
    },
    {
      field: 'eta_date',
      label: 'ETA日期',
      type: 'dateRange',
      dateFields: ['eta_date'],
    },
    {
      field: 'pickup_date',
      label: '提柜日期',
      type: 'dateRange',
      dateFields: ['pickup_date'],
    },
    {
      field: 'unload_date',
      label: '拆柜日期',
      type: 'dateRange',
      dateFields: ['unload_date'],
    },
  ], [])

  // 关系字段的模糊搜索加载函数
  const fieldFuzzyLoadOptions = React.useMemo(() => ({
    carrier_id: async (search: string): Promise<FuzzySearchOption[]> => {
      try {
        const params = new URLSearchParams()
        if (search) {
          params.append('search', search)
        }
        params.append('unlimited', 'true')
        const response = await fetch(`/api/carriers?${params.toString()}`)
        if (!response.ok) throw new Error('加载承运公司失败')
        const data = await response.json()
        const items = data.data || []
        return items.map((item: any) => ({
          value: String(item.carrier_id || item.id),
          label: item.name || '',
          description: item.carrier_code || undefined,
        }))
      } catch (error) {
        console.error('加载承运公司选项失败:', error)
        return []
      }
    },
    port_location_id: async (search: string): Promise<FuzzySearchOption[]> => {
      try {
        const params = new URLSearchParams()
        if (search) {
          params.append('search', search)
        }
        params.append('unlimited', 'true')
        const response = await fetch(`/api/locations?${params.toString()}`)
        if (!response.ok) throw new Error('加载码头失败')
        const data = await response.json()
        const items = data.data || []
        return items.map((item: any) => ({
          value: String(item.location_id || item.id),
          label: `${item.location_code || ''} - ${item.name || ''}`,
          description: item.name || undefined,
        }))
      } catch (error) {
        console.error('加载码头选项失败:', error)
        return []
      }
    },
  }), [])

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        operationMode: operationMode,
      })
      
      // 简单搜索
      if (search && search.trim()) {
        params.append("search", search.trim())
      }
      
      // 筛选参数
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          // 日期范围筛选的参数名已经包含 _from 或 _to
          params.append(`filter_${key}`, String(value))
        }
      })
      
      // 高级搜索参数
      Object.entries(advancedSearchValues).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(`advanced_${key}`, String(value))
        }
      })
      if (Object.keys(advancedSearchValues).length > 0 && advancedSearchLogic !== 'AND') {
        params.append('advanced_logic', advancedSearchLogic)
      }

      const response = await fetch(`/api/operations-tracking?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`获取${title}数据失败`)
      }

      const result = await response.json()
      setData(result.items || [])
      setTotal(result.total || 0)
    } catch (error: any) {
      console.error(`获取${title}数据失败:`, error)
      toast.error(`获取${title}数据失败: ` + (error.message || "未知错误"))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, operationMode, search, filterValues, advancedSearchValues, advancedSearchLogic, title])

  // 筛选处理函数
  const handleFilterChange = React.useCallback((field: string, value: any) => {
    setFilterValues((prev) => {
      const newFilters = { ...prev, [field]: value }
      // 如果值为空，删除该筛选
      if (value === null || value === undefined || value === '') {
        delete newFilters[field]
      }
      return newFilters
    })
    setPage(1) // 筛选时重置到第一页
  }, [])

  // 清除所有筛选
  const handleClearFilters = React.useCallback(() => {
    setFilterValues({})
    setPage(1)
  }, [])

  // 高级搜索处理函数
  const handleAdvancedSearchChange = React.useCallback((field: string, value: any) => {
    setAdvancedSearchValues((prev) => {
      const newValues = { ...prev, [field]: value }
      // 如果值为空，删除该条件
      if (value === null || value === undefined || value === '') {
        delete newValues[field]
      }
      return newValues
    })
  }, [])

  // 执行高级搜索
  const handleAdvancedSearch = React.useCallback(() => {
    setAdvancedSearchOpen(false)
    setPage(1) // 搜索时重置到第一页
  }, [])

  // 重置高级搜索
  const handleResetAdvancedSearch = React.useCallback(() => {
    setAdvancedSearchValues({})
    setAdvancedSearchLogic('AND')
  }, [])

  // 搜索防抖：当搜索关键词改变时，延迟500ms后更新
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // 筛选和高级搜索改变时重置到第一页
  React.useEffect(() => {
    setPage(1)
  }, [filterValues, advancedSearchValues])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 格式化日期（不做时区转换，直接解析日期字符串，与其他页面保持一致）
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      // 如果是 YYYY-MM-DD 格式，直接提取并格式化（不做时区转换）
      if (typeof dateString === 'string') {
        // 处理 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss 格式
        const datePart = dateString.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const parts = datePart.split('-')
          if (parts.length === 3) {
            return `${parts[1]}-${parts[2]}`
          }
        }
      }
      // 如果已经是其他格式，尝试解析但不做时区转换
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      // 使用本地日期，不做时区转换（与订单详情页保持一致）
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${month}-${day}`
    } catch {
      return dateString
    }
  }
  
  // 格式化日期时间（用于提柜日期等带时间的字段）
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      // 如果是 YYYY-MM-DD 格式，直接提取并格式化
      if (typeof dateString === 'string') {
        const datePart = dateString.split('T')[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const parts = datePart.split('-')
          if (parts.length === 3) {
            return `${parts[1]}-${parts[2]}`
          }
        }
        // 如果是 ISO 格式（带时间），提取日期和时间部分
        if (dateString.includes('T')) {
          const [datePart, timePart] = dateString.split('T')
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && timePart) {
            const parts = datePart.split('-')
            const time = timePart.split('.')[0].substring(0, 5) // 取 HH:mm
            return `${parts[1]}-${parts[2]} ${time}`
          }
        }
      }
      // 如果已经是其他格式，尝试解析但不做时区转换
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      // 使用本地日期时间，不做时区转换
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  // 格式化时效（天数）
  const formatLeadTime = (days: number | null) => {
    if (days === null) return "-"
    return `${days}天`
  }

  // 根据操作模式决定是否显示拆柜相关字段
  const showUnloadFields = operationMode === 'unload'

  const columns: ColumnDef<OperationsTrackingItem>[] = [
    {
      accessorKey: "container_number",
      header: "柜号",
      cell: ({ row }) => <div className="font-medium">{row.original.container_number}</div>,
    },
    {
      accessorKey: "port_code",
      header: "码头",
      cell: ({ row }) => <div>{row.original.port_code || "-"}</div>,
    },
    {
      accessorKey: "carrier_name",
      header: "承运公司",
      cell: ({ row }) => <div>{row.original.carrier_name || "-"}</div>,
    },
    {
      accessorKey: "eta_date",
      header: "ETA",
      cell: ({ row }) => <div>{formatDate(row.original.eta_date)}</div>,
    },
    {
      accessorKey: "lfd_date",
      header: "LFD",
      cell: ({ row }) => <div>{formatDate(row.original.lfd_date)}</div>,
    },
    {
      accessorKey: "pickup_date",
      header: "提柜日期",
      cell: ({ row }) => <div>{formatDateTime(row.original.pickup_date)}</div>,
    },
    // 拆柜日期：只在拆柜模式下显示
    ...(showUnloadFields ? [{
      accessorKey: "unload_date",
      header: "拆柜日期",
      cell: ({ row }) => <div>{formatDate(row.original.unload_date)}</div>,
    }] : []),
    {
      accessorKey: "return_deadline",
      header: "还柜日期",
      cell: ({ row }) => <div>{formatDate(row.original.return_deadline)}</div>,
    },
    {
      accessorKey: "pickup_lead_time",
      header: "提柜时效",
      cell: ({ row }) => <div>{formatLeadTime(row.original.pickup_lead_time)}</div>,
    },
    // 拆柜时效：只在拆柜模式下显示
    ...(showUnloadFields ? [{
      accessorKey: "unload_lead_time",
      header: "拆柜时效",
      cell: ({ row }) => <div>{formatLeadTime(row.original.unload_lead_time)}</div>,
    }] : []),
    {
      accessorKey: "chassis_days",
      header: "车架天数",
      cell: ({ row }) => <div>{formatLeadTime(row.original.chassis_days)}</div>,
    },
  ]

  // 展开行内容组件
  const getExpandedContent = (row: OperationsTrackingItem) => {
    if (!row.details || row.details.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">暂无明细数据</div>
      )
    }

    // 拆柜不显示ISA，直送显示ISA
    const showISA = operationMode === 'delivery'

    return (
      <div className="p-4 bg-muted/30">
        <h4 className="font-semibold mb-3 text-sm">订单明细</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">仓点</TableHead>
                {/* 拆柜板数：只在拆柜模式下显示 */}
                {showUnloadFields && <TableHead className="min-w-[100px]">拆柜板数</TableHead>}
                <TableHead className="min-w-[100px]">剩余板数</TableHead>
                <TableHead className="min-w-[100px]">窗口期</TableHead>
                {showISA && <TableHead className="min-w-[120px]">ISA</TableHead>}
                <TableHead className="min-w-[100px]">送仓日期</TableHead>
                <TableHead className="min-w-[100px]">送仓时效</TableHead>
                <TableHead className="min-w-[200px]">备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.details.map((detail) => (
                <TableRow key={detail.id}>
                  <TableCell>{detail.location_code || "-"}</TableCell>
                  {/* 拆柜板数：只在拆柜模式下显示 */}
                  {showUnloadFields && <TableCell>{detail.unload_pallets ?? "-"}</TableCell>}
                  <TableCell>{detail.remaining_pallets ?? "-"}</TableCell>
                  <TableCell>{detail.window_period || "-"}</TableCell>
                  {showISA && <TableCell>{detail.isa || "-"}</TableCell>}
                  <TableCell>{formatDate(detail.delivery_date)}</TableCell>
                  <TableCell>{formatLeadTime(detail.delivery_lead_time)}</TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {detail.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题区域 - 高端设计 */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl" />
        <div className="relative flex items-center justify-between p-6 bg-gradient-to-br from-white/80 via-blue-50/50 to-indigo-50/30 dark:from-gray-900/80 dark:via-blue-950/50 dark:to-indigo-950/30 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-xl shadow-gray-900/5 dark:shadow-gray-900/20">
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-base font-medium">
              实时汇总订单、入库管理、送仓管理等关键信息
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {total.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                总记录数
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                fetchData()
                toast.success("数据已刷新")
              }}
              disabled={loading}
              className="h-12 px-6 border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
            >
              <RefreshCw className={`mr-2 h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </div>
      </div>

      {/* 搜索模块 - 使用框架标准组件 */}
      <SearchModule
        searchPlaceholder="搜索柜号..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        total={total}
        filterFields={filterFields}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        advancedSearchFields={advancedSearchFields}
        advancedSearchOpen={advancedSearchOpen}
        onAdvancedSearchOpenChange={setAdvancedSearchOpen}
        advancedSearchValues={advancedSearchValues}
        advancedSearchLogic={advancedSearchLogic}
        onAdvancedSearchChange={handleAdvancedSearchChange}
        onAdvancedSearchLogicChange={setAdvancedSearchLogic}
        onAdvancedSearch={handleAdvancedSearch}
        onResetAdvancedSearch={handleResetAdvancedSearch}
        fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
      />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        serverSidePagination={true}
        expandableRows={{
          enabled: true,
          getExpandedContent,
        }}
      />
    </div>
  )
}

