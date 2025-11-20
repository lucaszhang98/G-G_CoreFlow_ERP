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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Search } from "lucide-react"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { formatDate, getStatusBadge, getContainerTypeBadge } from "@/lib/utils"

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
      cell: ({ row }) => getContainerTypeBadge(row.original.source_type),
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
          
          if (!containerId || containerId === 'undefined' || containerId === 'null' || containerId === '') {
            toast.error('无法获取容器ID')
            return
          }
          
          const url = `/dashboard/tms/containers/${containerId}`
          
          try {
            router.push(url)
          } catch {
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
  ], [router])

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

