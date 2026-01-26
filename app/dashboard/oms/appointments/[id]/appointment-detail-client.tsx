"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailTable, type DetailTableConfig } from '@/components/crud/detail-table'

interface AppointmentDetailClientProps {
  appointmentId: string
  appointment: any
}

export function AppointmentDetailClient({ appointmentId, appointment }: AppointmentDetailClientProps) {
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
      po: true,
      notes: true,
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
