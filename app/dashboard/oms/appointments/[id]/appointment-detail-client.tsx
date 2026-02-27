"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailTable, type DetailTableConfig } from '@/components/crud/detail-table'

interface AppointmentDetailClientProps {
  appointmentId: string
  appointment: any
  /** 出库详情页为 true 时，显示并可编辑装车单明细备注、BOL明细备注（每条明细行） */
  showOutboundLineNotes?: boolean
}

export function AppointmentDetailClient({ appointmentId, appointment, showOutboundLineNotes }: AppointmentDetailClientProps) {
  const handleRefresh = React.useCallback(() => {
    // 刷新页面以更新数据
    window.location.reload()
  }, [])

  const appointmentDetailConfig: DetailTableConfig = {
    title: '预约明细',
    showExpandable: false,
    showColumns: {
      orderNumber: true,
      location: true,
      locationType: true,
      estimatedPallets: true,
      unloadTime: true, // 拆柜时间（来自入库管理，按明细对应订单关联）
      ignoreUnloadTimeCheck: true, // 忽略：勾选后柜号强制绿色
      po: false, // 预约明细子表内不显示 PO
      notes: true,
      ...(showOutboundLineNotes && { loadSheetNotes: true, bolNotes: true }),
    },
    getLocationName: (detail, context) => {
      return detail.order_detail_item_order_detail_item_detail_idToorder_detail?.[0]?.detail_name 
        || context.deliveryLocation 
        || (detail as any).delivery_location_code
        || detail.delivery_location
        || '-'
    },
    getOrderNumber: (detail, context) => {
      return detail.order_number || context.orderNumber || '-'
    },
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>预约明细</CardTitle>
      </CardHeader>
      <CardContent>
        <DetailTable
          appointmentId={appointmentId}
          onRefresh={handleRefresh}
          config={appointmentDetailConfig}
          context={{ 
            orderNumber: appointment.orders?.order_number || null,
            deliveryLocation: appointment.locations?.location_code || null,
            appointmentId: appointmentId 
          }}
        />
      </CardContent>
    </Card>
  )
}
