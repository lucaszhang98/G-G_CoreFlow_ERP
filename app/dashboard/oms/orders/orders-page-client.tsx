"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { orderConfig } from "@/lib/crud/configs/orders"
import { CreateOrderDialog } from "./create-order-dialog"
import { OrderImportDialog } from "./order-import-dialog"
import { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, Database } from "lucide-react"
import { toast } from "sonner"
import ExcelJS from "exceljs"
import { generateOrderExportExcel, OrderExportData } from "@/lib/utils/order-export-excel"
export function OrdersPageClient() {
  const [mounted, setMounted] = React.useState(false)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])
  const [currentSearchParams, setCurrentSearchParams] = React.useState<URLSearchParams>(new URLSearchParams())
  const [totalCount, setTotalCount] = React.useState(0) // 全部数据总数（固定值，只在初始加载时设置）
  const [filteredCount, setFilteredCount] = React.useState(0) // 当前筛选结果数

  // 防止 hydration 错误
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 初始加载时获取全部数据总数（排除archived，与默认显示一致）
  React.useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        // 获取默认筛选下的总数（排除archived）
        const response = await fetch('/api/oms/orders?page=1&limit=1')
        if (response.ok) {
          const data = await response.json()
          const total = data.pagination?.total ?? data.total ?? 0
          setTotalCount(total)
          setFilteredCount(total) // 初始时，筛选结果数等于总数
        }
      } catch (error) {
        console.error('获取总数失败:', error)
      }
    }
    fetchTotalCount()
  }, [refreshKey]) // 刷新时重新获取

  // 处理EntityTable的总数变化（只在首次加载时更新totalCount）
  const handleTotalChange = React.useCallback((newTotal: number) => {
    // 只在totalCount为0时更新（首次加载）
    if (totalCount === 0) {
      setTotalCount(newTotal)
    }
  }, [totalCount])

  // 处理EntityTable的筛选结果数变化（每次都更新）
  const handleFilteredTotalChange = React.useCallback((newFilteredTotal: number) => {
    setFilteredCount(newFilteredTotal)
  }, [])

  const handleCreateSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  // 导出选中行（前端生成Excel）
  const handleExportSelected = async () => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要导出的订单')
      return
    }

    try {
      toast.loading('正在生成Excel文件...')

      // 转换数据格式
      const exportData: OrderExportData[] = selectedRows.map((row: any) => ({
        order_number: row.order_number,
        customer_code: row.customer_code || row.customer?.code || null,
        customer_name: row.customer_name || row.customer?.name || null,
        user_name: row.user_name || row.users?.full_name || null,
        order_date: row.order_date,
        status: row.status,
        operation_mode: row.operation_mode,
        delivery_location: row.delivery_location,
        container_type: row.container_type,
        container_volume: row.container_volume,
        eta_date: row.eta_date,
        lfd_date: row.lfd_date,
        pickup_date: row.pickup_date,
        ready_date: row.ready_date,
        return_deadline: row.return_deadline,
        carrier_name: row.carrier_name || row.carriers?.name || null,
        port_location: row.port_location,
        mbl_number: row.mbl_number,
        do_issued: row.do_issued,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `订单管理_选中_${timestamp}`

      const workbook = await generateOrderExportExcel(exportData, filename)
      const buffer = await workbook.xlsx.writeBuffer()

      // 下载文件
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`成功导出 ${selectedRows.length} 条订单数据`)
    } catch (error) {
      console.error('导出失败:', error)
      toast.dismiss()
      toast.error('导出失败，请重试')
    }
  }

  // 导出筛选结果（后端生成Excel）
  const handleExportFiltered = async () => {
    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        if (filteredCount > 1000) {
          const result = window.confirm(
            `即将导出 ${filteredCount} 条数据，可能需要数秒时间。是否继续？`
          )
          resolve(result)
        } else {
          resolve(true)
        }
      })

      if (!confirmed) return

      toast.loading('正在生成Excel文件，请稍候...')

      const response = await fetch(`/api/oms/orders/export?${currentSearchParams.toString()}`)
      if (!response.ok) {
        let errorMsg = `导出失败 (${response.status})`
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorMsg
        } catch (e) {
          // JSON解析失败，使用默认错误消息
        }
        throw new Error(errorMsg)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `订单管理_筛选_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`成功导出 ${filteredCount} 条数据`)
    } catch (error: any) {
      console.error('导出筛选结果失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }

  // 导出全部数据（后端生成Excel）
  const handleExportAll = async () => {
    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        if (totalCount > 1000) {
          const result = window.confirm(
            `即将导出全部 ${totalCount} 条数据，可能需要较长时间。是否继续？`
          )
          resolve(result)
        } else {
          resolve(true)
        }
      })

      if (!confirmed) return

      toast.loading('正在生成Excel文件，请稍候...')

      const response = await fetch('/api/oms/orders/export?all=true')
      if (!response.ok) {
        let errorMsg = `导出失败 (${response.status})`
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorMsg
        } catch (e) {
          // JSON解析失败，使用默认错误消息
        }
        throw new Error(errorMsg)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `订单管理_全部_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`成功导出 ${totalCount} 条数据`)
    } catch (error: any) {
      console.error('导出全部数据失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }

  // 订单管理不允许删除（单个和批量都不允许）
  const customActions = {
    onDelete: undefined, // 禁用单个删除
    onAdd: () => setCreateDialogOpen(true), // 自定义创建操作
  }

  // 批量导入配置
  const importConfig = {
    enabled: true,
    onImport: () => setImportDialogOpen(true),
  }

  // 为客户字段提供模糊搜索选项加载函数
  const loadCustomerOptions = async (search: string): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('unlimited', 'true')
      const response = await fetch(`/api/customers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('加载客户选项失败')
      }
      const data = await response.json()
      const customers = data.data || []
      return customers.map((customer: any) => ({
        value: String(customer.id),
        label: customer.code || customer.name || String(customer.id),
        description: customer.name || customer.company_name,
      }))
    } catch (error) {
      console.error('加载客户选项失败:', error)
      return []
    }
  }

  // 为用户字段提供模糊搜索选项加载函数
  const loadUserOptions = async (search: string): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('unlimited', 'true')
      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) {
        throw new Error('加载用户选项失败')
      }
      const data = await response.json()
      const users = data.data || []
      return users.map((user: any) => ({
        value: String(user.id),
        label: user.full_name || user.username || String(user.id),
        description: user.username,
      }))
    } catch (error) {
      console.error('加载用户选项失败:', error)
      return []
    }
  }

  // 为关系字段提供模糊搜索选项加载函数
  const fieldFuzzyLoadOptions = {
    customer: loadCustomerOptions,
    user_id: loadUserOptions,
  }

  // 自定义批量操作按钮（导出选中）
  const customBatchActions = selectedRows.length > 0 ? (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExportSelected}
      className="min-w-[100px] h-9"
    >
      <Download className="mr-2 h-4 w-4" />
      导出选中 ({selectedRows.length}条)
    </Button>
  ) : null

  // 自定义工具栏按钮（批量导出下拉菜单）
  const customToolbarButtons = mounted ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline"
          size="lg"
          className="group relative h-11 px-6 text-base font-medium border-2 border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Download className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
          <span>批量导出</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-[260px] p-2 bg-white border-2 border-blue-100 shadow-xl rounded-lg"
      >
        <DropdownMenuItem 
          onClick={handleExportFiltered}
          className="px-4 py-3 rounded-md hover:bg-blue-50 cursor-pointer transition-colors duration-150 focus:bg-blue-50"
        >
          <FileSpreadsheet className="mr-3 h-5 w-5 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">导出筛选结果</span>
            <span className="text-xs text-gray-500 mt-0.5">
              符合当前条件的 {filteredCount} 条数据
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleExportAll}
          className="px-4 py-3 rounded-md hover:bg-blue-50 cursor-pointer transition-colors duration-150 focus:bg-blue-50 mt-1"
        >
          <Database className="mr-3 h-5 w-5 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">导出全部数据</span>
            <span className="text-xs text-gray-500 mt-0.5">
              全部 {totalCount} 条数据
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button 
      variant="outline"
      size="lg"
      disabled
      className="group relative h-11 px-6 text-base font-medium border-2 border-blue-200 bg-white text-blue-600 shadow-sm"
    >
      <Download className="mr-2 h-5 w-5" />
      <span>批量导出</span>
    </Button>
  )

  return (
    <>
      <EntityTable 
        refreshKey={refreshKey}
        config={orderConfig} 
        customActions={customActions}
        fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
        importConfig={importConfig}
        customBatchActions={customBatchActions}
        customToolbarButtons={customToolbarButtons}
        onRowSelectionChange={setSelectedRows}
        onSearchParamsChange={setCurrentSearchParams}
        onTotalChange={handleTotalChange}
        onFilteredTotalChange={handleFilteredTotalChange}
      />
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
      <OrderImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </>
  )
}

