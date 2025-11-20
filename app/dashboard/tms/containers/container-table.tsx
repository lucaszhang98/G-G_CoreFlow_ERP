"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Search } from "lucide-react"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

interface Container {
  container_id: string
  status: string | null
  source_type: string
  notes: string | null
  created_at: string | Date | null
  updated_at: string | Date | null
  order_id: string | null
  trailer_id: string | null
  orders?: {
    order_id: string
    order_number: string
    order_date: string | Date | null
    status: string | null
    customers?: {
      id: string
      name: string
      code: string
    } | null
  } | null
  trailers?: {
    trailer_id: string
    trailer_code: string | null
  } | null
}

export function ContainerTable() {
  const router = useRouter()
  const [data, setData] = React.useState<Container[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(20)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [sourceTypeFilter, setSourceTypeFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  // 获取数据
  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (search) params.append('search', search)
      if (sourceTypeFilter && sourceTypeFilter !== 'all') params.append('source_type', sourceTypeFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/tms/containers?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '获取数据失败')
      }
      const result = await response.json()
      
      // 数据已经在 API 中序列化为字符串，直接使用
      setData(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (error: any) {
      console.error('获取容器列表失败:', error)
      // 只在非网络错误时显示 toast（避免重复提示）
      if (!error.message?.includes('fetch')) {
        toast.error(error.message || '获取数据失败')
      }
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, sourceTypeFilter, statusFilter])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = React.useCallback((date: string | Date | null) => {
    if (!date) return "-"
    
    // 尝试解析日期
    let d: Date
    if (date instanceof Date) {
      d = date
    } else if (typeof date === 'string') {
      d = new Date(date)
    } else {
      return "-"
    }
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      console.warn('无效的日期:', date)
      return "-"
    }
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    
    // 再次检查结果是否有效
    if (isNaN(year) || isNaN(Number(month)) || isNaN(Number(day))) {
      console.warn('日期格式化失败:', { date, year, month, day })
      return "-"
    }
    
    return `${year}-${month}-${day}`
  }, [])

  const getStatusBadge = React.useCallback((status: string | null) => {
    if (!status) return <Badge variant="secondary">-</Badge>
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: '待处理', variant: 'secondary' },
      transit: { label: '运输中', variant: 'default' },
      delivered: { label: '已交付', variant: 'default' },
      canceled: { label: '已取消', variant: 'destructive' },
      rejected: { label: '已拒绝', variant: 'destructive' },
    }
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }, [])

  const getSourceTypeBadge = React.useCallback((sourceType: string) => {
    const typeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      sea_container: { label: '海柜', variant: 'default' },
      company_trailer: { label: '公司拖车', variant: 'secondary' },
    }
    const typeInfo = typeMap[sourceType] || { label: sourceType, variant: 'outline' as const }
    return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
  }, [])

  const columns: ColumnDef<Container>[] = React.useMemo(() => [
    {
      accessorKey: "container_id",
      header: "容器ID",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.container_id}</span>
      ),
    },
    {
      accessorKey: "source_type",
      header: "容器类型",
      cell: ({ row }) => getSourceTypeBadge(row.original.source_type),
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: "orders.order_number",
      header: "关联订单",
      cell: ({ row }) => {
        const order = row.original.orders
        if (!order) return "-"
        return (
          <span className="text-primary hover:underline cursor-pointer">
            {order.order_number}
          </span>
        )
      },
    },
    {
      accessorKey: "orders.customers.name",
      header: "客户",
      cell: ({ row }) => {
        const customer = row.original.orders?.customers
        return customer ? customer.name : "-"
      },
    },
    {
      accessorKey: "orders.order_date",
      header: "订单日期",
      cell: ({ row }) => {
        const orderDate = row.original.orders?.order_date
        return formatDate(orderDate || null)
      },
    },
    {
      accessorKey: "created_at",
      header: "创建时间",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const container = row.original
        const containerId = String(container.container_id || '')
        
        if (!containerId || containerId === 'undefined' || containerId === 'null' || containerId === '') {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        
        const handleViewClick = (e: React.MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          
          // 确保 containerId 是有效的字符串
          if (!containerId || containerId === 'undefined' || containerId === 'null' || containerId === '') {
            console.error('无效的容器ID:', { containerId, container })
            toast.error('无法获取容器ID')
            return
          }
          
          const url = `/dashboard/tms/containers/${containerId}`
          
          // Next.js App Router 的 router.push 不返回 Promise，直接调用即可
          try {
            router.push(url)
          } catch (error) {
            console.error('router.push 失败:', error)
            // 如果 router.push 失败，使用 window.location 作为备选
            window.location.href = url
          }
        }
        
        return (
          <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleViewClick}
              title={`查看容器 ${containerId} 详情`}
              type="button"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ], [router, formatDate, getStatusBadge, getSourceTypeBadge])

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>容器管理</CardTitle>
          <CardDescription>管理所有容器，包括海柜和拖车</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索订单号..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>

            {/* 筛选器 */}
            <Select
              value={sourceTypeFilter}
              onValueChange={(value) => {
                setSourceTypeFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="容器类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="sea_container">海柜</SelectItem>
                <SelectItem value="company_trailer">公司拖车</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="transit">运输中</SelectItem>
                <SelectItem value="delivered">已交付</SelectItem>
                <SelectItem value="canceled">已取消</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 数据表格 */}
          <DataTable
            columns={columns}
            data={data}
            loading={loading}
            total={total}
            page={page}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            serverSidePagination={true}
          />
        </CardContent>
      </Card>
    </div>
  )
}

