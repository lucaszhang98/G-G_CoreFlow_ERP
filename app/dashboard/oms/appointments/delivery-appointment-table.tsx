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

export function DeliveryAppointmentTable() {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [showImportDialog, setShowImportDialog] = React.useState(false)

  // 隐藏查看详情按钮，但保留删除功能
  const customActions = React.useMemo(() => ({
    onView: null as any, // 设置为 null 以隐藏查看详情按钮
    // onDelete 不设置（undefined），使用配置中的默认删除功能（单个删除）
  }), [])

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

  const appointmentDetailConfig: DetailTableConfig = {
    title: '预约明细',
    showExpandable: false,
    showColumns: {
      orderNumber: true,
      location: true,
      locationType: true,
      // totalVolume: false, // 总方数不需要显示
      // totalPallets: false, // 总板数不需要显示
      estimatedPallets: true,
      po: true,
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

  return (
    <>
      <EntityTable 
        key={refreshKey}
        config={deliveryAppointmentConfig}
        customActions={customActions}
        importConfig={{
          enabled: true,
          onImport: handleImportClick,
        }}
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

