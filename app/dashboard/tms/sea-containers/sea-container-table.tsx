"use client"

import * as React from "react"
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
import { Search, CheckCircle, XCircle } from "lucide-react"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { EditableCell } from "@/components/ui/editable-cell"
import { createStandardTableConfig } from "@/lib/table/utils"
import { useRouter } from "next/navigation"

interface SeaContainer {
  container_id: string
  container_number: string
  mbl: string | null
  port_location: string | null
  customer: string | null
  customer_code: string | null
  container_type: string | null
  carrier: string | null
  do_issued: boolean
  order_date: string | Date | null
  eta_date: string | Date | null
  operation_mode: string | null
  delivery_location: string | null
  lfd_date: string | Date | null
  pickup_date: string | Date | null
  return_date: string | Date | null
  appointment_number: string | null
  appointment_time: string | Date | null
  warehouse_account: string | null
  order_id: string | null
  order_number: string | null
  status: string | null
  created_at: string | Date | null
}

export function SeaContainerTable() {
  const router = useRouter()
  const [data, setData] = React.useState<SeaContainer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(20)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [containerToDelete, setContainerToDelete] = React.useState<SeaContainer | null>(null)

  // 获取数据
  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (search) params.append('search', search)

      const response = await fetch(`/api/tms/sea-containers?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '获取数据失败')
      }
      const result = await response.json()
      
      setData(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (error: any) {
      if (!error.message?.includes('fetch')) {
        toast.error(error.message || '获取数据失败')
      }
    } finally {
      setLoading(false)
    }
  }, [page, limit, search])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 保存单元格编辑
  const handleCellSave = React.useCallback(async (
    containerId: string,
    orderId: string | null,
    field: string,
    value: string | null
  ) => {
    if (!orderId) {
      toast.error("无法保存：缺少订单ID")
      return
    }

    try {
      const response = await fetch(`/api/tms/sea-containers/${containerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field,
          value,
          order_id: orderId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "保存失败")
      }

      toast.success("保存成功")
      // 刷新数据
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "保存失败")
      throw error // 重新抛出，让EditableCell知道保存失败
    }
  }, [fetchData])

  // 格式化日期 - 使用与 EditableCell 完全相同的逻辑
  // 如果已经是 YYYY-MM-DD 格式的字符串，直接返回
  // 否则使用 toISOString().split("T")[0] 提取日期部分
  const formatDateDisplay = (date: Date | string | null) => {
    if (!date) return "-"
    // 如果已经是 YYYY-MM-DD 格式的字符串，直接返回
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date
    }
    // 如果是 ISO 字符串格式，提取日期部分
    if (typeof date === 'string' && date.includes('T')) {
      return date.split('T')[0]
    }
    // 否则解析为 Date 对象，使用 toISOString().split("T")[0]
    // 这样与 EditableCell 的显示逻辑完全一致
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return "-"
    return d.toISOString().split("T")[0]
  }

  // 格式化日期时间
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-"
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return "-"
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }

  // 处理查看详情
  const handleView = React.useCallback((container: SeaContainer) => {
    // 海柜管理暂时没有详情页，可以跳转到订单详情
    if (container.order_id) {
      router.push(`/dashboard/oms/orders/${container.order_id}`)
    }
  }, [router])

  // 处理删除
  const handleDelete = React.useCallback((container: SeaContainer) => {
    setContainerToDelete(container)
    setDeleteDialogOpen(true)
  }, [])

  // 确认删除
  const confirmDelete = React.useCallback(async () => {
    if (!containerToDelete) return

    try {
      // 这里需要实现删除API
      toast.error("删除功能暂未实现")
      setDeleteDialogOpen(false)
      setContainerToDelete(null)
    } catch (error: any) {
      console.error("删除海柜失败:", error)
      toast.error(error.message || "删除海柜失败")
    }
  }, [containerToDelete])

  // 定义17列（不包含操作列，操作列由框架自动添加）
  const baseColumns: ColumnDef<SeaContainer>[] = React.useMemo(() => {
    return [
    {
      accessorKey: "container_number",
      header: "柜号",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.container_number}</span>
      ),
    },
    {
      accessorKey: "mbl",
      header: "MBL",
      cell: ({ row }) => (
        <span>{row.original.mbl || "-"}</span>
      ),
    },
    {
      accessorKey: "port_location",
      header: "码头/查验站",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.port_location}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "port_location",
            value
          )}
          type="text"
        />
      ),
    },
    {
      accessorKey: "customer",
      header: "客户",
      cell: ({ row }) => row.original.customer || "-",
    },
    {
      accessorKey: "container_type",
      header: "柜型",
      cell: ({ row }) => (
        <span>{row.original.container_type || "-"}</span>
      ),
    },
    {
      accessorKey: "carrier",
      header: "承运公司",
      cell: ({ row }) => (
        <span>{row.original.carrier || "-"}</span>
      ),
    },
    {
      accessorKey: "do_issued",
      header: "DO",
      cell: ({ row }) => (
        row.original.do_issued ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-400" />
        )
      ),
    },
    {
      accessorKey: "order_date",
      header: "订单日期",
      cell: ({ row }) => formatDateDisplay(row.original.order_date),
    },
    {
      accessorKey: "eta_date",
      header: "ETA",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.eta_date ? formatDateDisplay(row.original.eta_date) : null}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "eta_date",
            value
          )}
          type="date"
        />
      ),
    },
    {
      accessorKey: "operation_mode",
      header: "操作方式",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.operation_mode}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "operation_mode",
            value
          )}
          type="text"
        />
      ),
    },
    {
      accessorKey: "delivery_location",
      header: "送货地",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.delivery_location}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "delivery_location",
            value
          )}
          type="text"
        />
      ),
    },
    {
      accessorKey: "lfd_date",
      header: "LFD",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.lfd_date ? formatDateDisplay(row.original.lfd_date) : null}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "lfd_date",
            value
          )}
          type="date"
        />
      ),
    },
    {
      accessorKey: "pickup_date",
      header: "提柜日期",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.pickup_date ? formatDateDisplay(row.original.pickup_date) : null}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "pickup_date",
            value
          )}
          type="date"
        />
      ),
    },
    {
      accessorKey: "return_date",
      header: "还柜日期",
      cell: ({ row }) => (
        <EditableCell
          value={row.original.return_date ? formatDateDisplay(row.original.return_date) : null}
          onSave={(value) => handleCellSave(
            row.original.container_id,
            row.original.order_id,
            "return_date",
            value
          )}
          type="date"
        />
      ),
    },
    {
      accessorKey: "appointment_number",
      header: "预约号码",
      cell: ({ row }) => row.original.appointment_number || "-",
    },
    {
      accessorKey: "appointment_time",
      header: "预约时间",
      cell: ({ row }) => formatDateTime(row.original.appointment_time),
    },
    {
      accessorKey: "warehouse_account",
      header: "约仓账号",
      cell: ({ row }) => (
        <span>{row.original.warehouse_account || "-"}</span>
      ),
    },
  ]
  }, [handleCellSave])

  // 使用新框架创建表格配置
  const tableConfig = React.useMemo(() => {
    return createStandardTableConfig<SeaContainer>({
      columns: baseColumns,
      // 可排序列配置（这些列允许排序）
      sortableColumns: [
        "container_number",
        "mbl",
        "customer",
        "container_type",
        "carrier",
        "order_date",
        "eta_date",
        "lfd_date",
        "pickup_date",
        "return_date",
        "appointment_time",
      ],
      // 列标签映射（用于列可见性控制）
      columnLabels: {
        container_number: "柜号",
        mbl: "MBL",
        port_location: "码头/查验站",
        customer: "客户",
        container_type: "柜型",
        carrier: "承运公司",
        do_issued: "DO",
        order_date: "订单日期",
        eta_date: "ETA",
        operation_mode: "操作方式",
        delivery_location: "送货地",
        lfd_date: "LFD",
        pickup_date: "提柜日期",
        return_date: "还柜日期",
        appointment_number: "预约号码",
        appointment_time: "预约时间",
        warehouse_account: "约仓账号",
      },
      // 显示操作列
      showActions: true,
      // 操作列配置
      actionsConfig: {
        onView: handleView,
        onDelete: handleDelete,
      },
    })
  }, [baseColumns, handleView, handleDelete])

  const { columns, sortableColumns, columnLabels } = tableConfig

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>海柜管理</CardTitle>
          <CardDescription>管理所有海柜容器，包含完整的运输信息</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索订单号、MBL..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </div>

          {/* 数据表格 - 使用横向滚动支持17列 */}
          <div className="overflow-x-auto">
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
              showColumnToggle={true}
              columnLabels={columnLabels}
              sortableColumns={sortableColumns}
            />
          </div>
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      {deleteDialogOpen && containerToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-muted-foreground mb-4">
              确定要删除海柜 "{containerToDelete.container_number}" 吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setContainerToDelete(null)
                }}
              >
                取消
              </Button>
              <Button variant="destructive" onClick={() => confirmDelete()}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

