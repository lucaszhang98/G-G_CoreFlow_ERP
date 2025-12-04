"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { InboundReceiptBasicInfoCard } from "./inbound-receipt-basic-info-card"
import { InboundReceiptDetailsTable } from "./inbound-receipt-details-table"

interface InboundReceiptDetailPageClientProps {
  inboundReceipt: any
  orderDetails: any[]
  inventoryLots: any[]
  deliveryAppointments: any[]
  inboundReceiptId: string
}

export function InboundReceiptDetailPageClient({
  inboundReceipt,
  orderDetails,
  inventoryLots,
  deliveryAppointments,
  inboundReceiptId,
}: InboundReceiptDetailPageClientProps) {
  // 格式化日期（不包含年份，节省空间）
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-"
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  const formatNumber = (value: number | null | string | any) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' 
      ? parseFloat(value) 
      : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* 入库管理基本信息卡片 */}
      <InboundReceiptBasicInfoCard
        inboundReceipt={inboundReceipt}
        formatDate={formatDate}
        formatNumber={formatNumber}
      />

      {/* 仓点明细表格 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>仓点明细</CardTitle>
          <CardDescription>该柜号的所有仓点信息</CardDescription>
        </CardHeader>
        <CardContent>
          <InboundReceiptDetailsTable
            inboundReceiptId={inboundReceiptId}
            orderDetails={orderDetails}
            inventoryLots={inventoryLots}
            deliveryAppointments={deliveryAppointments}
            warehouseId={inboundReceipt?.warehouse_id?.toString() || inboundReceipt?.warehouses?.warehouse_id?.toString() || ''}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}

