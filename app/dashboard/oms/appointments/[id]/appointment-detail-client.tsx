"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailTable, type DetailTableConfig } from '@/components/crud/detail-table'

interface AppointmentDetailClientProps {
  appointmentId: string
  appointment: any
  /** 出库详情页为 true 时，显示并可编辑装车单明细备注、BOL明细备注（每条明细行） */
  showOutboundLineNotes?: boolean
  /** 总排车板数（出库管理详情页传入，显示在子表上方） */
  totalPallets?: number | null
}

export function AppointmentDetailClient({ appointmentId, appointment, showOutboundLineNotes, totalPallets }: AppointmentDetailClientProps) {
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
      estimatedPallets: true, // 排车板数（原预计板数）
      actualPallets: true, // 实际板数（入库对应的实际板数）
      unloadTime: true, // 拆柜时间（来自入库管理，按明细对应订单关联）
      ignoreUnloadTimeCheck: true, // 忽略：勾选后柜号强制绿色
      windowPeriod: true, // 窗口期（来自订单明细）
      po: false, // 预约明细子表内不显示 PO
      notes: true,
      ...(showOutboundLineNotes && {
        loadSheetNotes: true,
        bolNotes: true,
        storageLocation: true, // 仓库位置（对应入库明细，可编辑）
        unbookedPallets: true, // 未约板数（订单明细动态计算，只读）
      }),
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
  
  // 调试：打印配置
  React.useEffect(() => {
    console.log('[AppointmentDetailClient] 配置:', {
      showOutboundLineNotes,
    })
  }, [showOutboundLineNotes])

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>预约明细</CardTitle>
          {totalPallets != null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-muted-foreground">总排车板数：</span>
              <span className="text-base font-semibold text-foreground tabular-nums">{totalPallets.toLocaleString()}</span>
            </div>
          )}
        </div>
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
