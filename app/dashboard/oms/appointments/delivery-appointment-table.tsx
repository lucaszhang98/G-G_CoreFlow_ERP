"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { EntityTable } from '@/components/crud/entity-table'
import { deliveryAppointmentConfig } from '@/lib/crud/configs/delivery-appointments'
import type { ClickableColumnConfig } from '@/lib/table/config'
import { DetailTable, type DetailTableConfig } from '@/components/crud/detail-table'

export function DeliveryAppointmentTable() {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = React.useState(0)

  // 隐藏查看详情按钮，但保留删除功能
  const customActions = React.useMemo(() => ({
    onView: null as any, // 设置为 null 以隐藏查看详情按钮（undefined 会使用默认的 handleView）
    // onDelete 不设置，使用配置中的默认删除功能（单个删除）
  }), [])

  const handleRefresh = React.useCallback(() => {
    setRefreshKey(prev => prev + 1)
    router.refresh()
  }, [router])

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
    <EntityTable 
      key={refreshKey}
      config={deliveryAppointmentConfig}
      customActions={customActions}
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
  )
}

