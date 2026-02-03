"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { EntityTable } from '@/components/crud/entity-table'
import { deliveryAppointmentConfig } from '@/lib/crud/configs/delivery-appointments'
import type { ClickableColumnConfig } from '@/lib/table/config'
import { DetailTable, type DetailTableConfig } from '@/components/crud/detail-table'
import { BaseImportDialog } from '@/components/import/base-import-dialog'
import { generateAppointmentImportTemplate } from '@/lib/utils/appointment-excel-template'
import * as ExcelJS from 'exceljs'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, Database } from "lucide-react"
import { toast } from "sonner"
import { generateAppointmentExportExcel, AppointmentExportData } from "@/lib/utils/appointment-export-excel"

export function DeliveryAppointmentTable() {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [showImportDialog, setShowImportDialog] = React.useState(false)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])
  const [currentSearchParams, setCurrentSearchParams] = React.useState<URLSearchParams>(new URLSearchParams())
  const [totalCount, setTotalCount] = React.useState(0) // 全部数据总数（固定值，只在初始加载时设置）
  const [filteredCount, setFilteredCount] = React.useState(0) // 当前筛选结果数

  // 初始加载时获取全部数据总数
  React.useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const response = await fetch('/api/wms/delivery-appointments?page=1&limit=1')
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

  // 启用查看详情按钮，跳转到预约详情页
  const customActions = React.useMemo(() => ({
    onView: (row: any) => {
      if (row.appointment_id) {
        router.push(`/dashboard/oms/appointments/${row.appointment_id}`)
      }
    },
    // onDelete 不设置（undefined），使用配置中的默认删除功能（单个删除）
  }), [router])

  const handleRefresh = React.useCallback(() => {
    setRefreshKey(prev => prev + 1)
    router.refresh()
  }, [router])

  const handleImportClick = React.useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleImportSuccess = React.useCallback(() => {
    setShowImportDialog(false)
    handleRefresh()
  }, [handleRefresh])

  const handleGenerateTemplate = React.useCallback(async (templateData?: any) => {
    return await generateAppointmentImportTemplate(templateData)
  }, [])

  const handleDownloadTemplate = React.useCallback(async (workbook: ExcelJS.Workbook, filename: string) => {
    try {
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // filename已经包含了.xlsx后缀，不需要再添加
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('下载模板失败:', error)
      throw error
    }
  }, [])

  // 导出选中行（前端生成Excel）
  const handleExportSelected = React.useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要导出的预约')
      return
    }

    try {
      toast.loading('正在生成Excel文件...')

      // 转换数据格式
      const exportData: AppointmentExportData[] = selectedRows.map((row: any) => ({
        reference_number: row.reference_number,
        delivery_method: row.delivery_method,
        appointment_account: row.appointment_account,
        appointment_type: row.appointment_type,
        origin_location: row.origin_location,
        destination_location: row.destination_location,
        confirmed_start: row.confirmed_start,
        total_pallets: row.total_pallets,
        rejected: row.rejected,
        po: row.po,
        notes: row.notes,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `送货预约管理_选中_${timestamp}`

      const workbook = await generateAppointmentExportExcel(exportData, filename)
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
      toast.success(`成功导出 ${selectedRows.length} 条预约数据`)
    } catch (error) {
      console.error('导出失败:', error)
      toast.dismiss()
      toast.error('导出失败，请重试')
    }
  }, [selectedRows])

  // 导出筛选结果（后端生成Excel）
  const handleExportFiltered = React.useCallback(async () => {
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

      const response = await fetch(`/api/wms/delivery-appointments/export?${currentSearchParams.toString()}`)
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
      a.download = `送货预约管理_筛选_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`成功导出 ${filteredCount} 条数据`)
    } catch (error: any) {
      console.error('导出筛选结果失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }, [filteredCount, currentSearchParams])

  // 导出全部数据（后端生成Excel）
  const handleExportAll = React.useCallback(async () => {
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

      const response = await fetch('/api/wms/delivery-appointments/export?all=true')
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
      a.download = `送货预约管理_全部_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`成功导出 ${totalCount} 条数据`)
    } catch (error: any) {
      console.error('导出全部数据失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }, [totalCount])

  const appointmentDetailConfig: DetailTableConfig = {
    title: '预约明细',
    showExpandable: false,
    showColumns: {
      orderNumber: true,
      location: true,
      locationType: true,
      estimatedPallets: true,
      unloadTime: true, // 拆柜时间（来自入库管理，按明细对应订单关联）
      po: true,
      notes: true,
    },
    getLocationName: (detail, context) => {
      return detail.order_detail_item_order_detail_item_detail_idToorder_detail?.[0]?.detail_name 
        || context.deliveryLocation 
        || '-'
    },
    getOrderNumber: (detail, context) => {
      return context.orderNumber || '-'
    },
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
  const customToolbarButtons = (
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
  )

  return (
    <>
      <EntityTable 
        refreshKey={refreshKey}
        config={deliveryAppointmentConfig}
        customActions={customActions}
        importConfig={{
          enabled: true,
          onImport: handleImportClick,
        }}
        customBatchActions={customBatchActions}
        customToolbarButtons={customToolbarButtons}
        onRowSelectionChange={setSelectedRows}
        onSearchParamsChange={setCurrentSearchParams}
        onTotalChange={handleTotalChange}
        onFilteredTotalChange={handleFilteredTotalChange}
        expandableRows={{
          enabled: true,
          getExpandedContent: (row: any) => {
          // 从 appointment_detail_lines 获取数据
          const appointmentId = row.appointment_id
          const orderId = row.orders?.order_id
          const orderNumber = row.orders?.order_number
          const deliveryLocation = row.orders?.delivery_location

          // 确保 appointmentId 是字符串格式
          const appointmentIdStr = appointmentId 
            ? (typeof appointmentId === 'bigint' || typeof appointmentId === 'number' ? String(appointmentId) : appointmentId)
            : undefined

          // 确保 orderId 是字符串格式（如果有的话）
          const orderIdStr = orderId 
            ? (typeof orderId === 'bigint' || typeof orderId === 'number' ? String(orderId) : orderId)
            : undefined

          // 传递 appointmentId 用于从 appointment_detail_lines 获取数据
          return (
            <DetailTable
              appointmentId={appointmentIdStr}
              orderId={orderIdStr}
              onRefresh={handleRefresh}
              config={appointmentDetailConfig}
              context={{ orderNumber, deliveryLocation, appointmentId: appointmentIdStr }}
            />
          )
        },
      }}
    />
      <BaseImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={handleImportSuccess}
        title="批量导入预约"
        description="支持批量导入预约及明细，系统会自动校验订单明细和剩余板数。位置代码请从下拉列表选择。"
        requiredFields="预约号码、订单号、派送方式、预约账号、预约类型、起始地、目的地、送货时间、仓点、性质、预计板数"
        apiEndpoint="/api/oms/appointments/import"
        templateFilename="预约批量导入模板"
        templateDataEndpoint="/api/oms/appointments/import/template"
        generateTemplate={handleGenerateTemplate}
        downloadTemplate={handleDownloadTemplate}
      />
    </>
  )
}

