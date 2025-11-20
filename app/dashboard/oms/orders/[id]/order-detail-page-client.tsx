"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { OrderBasicInfoCard } from "./order-basic-info-card"
import { OrderDetailsTable } from "./order-details-table"

interface OrderDetailPageClientProps {
  order: any
  orderDetails: any[]
  orderId: string
}

export function OrderDetailPageClient({
  order,
  orderDetails,
  orderId,
}: OrderDetailPageClientProps) {
  const router = useRouter()

  // 格式化函数 - 使用固定格式避免 hydration 错误
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-"
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatCurrency = (amount: string | number | null | any) => {
    if (!amount) return "-"
    const numValue = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    if (isNaN(numValue)) return "-"
    // 使用固定格式，避免 locale 差异
    return `$${numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  }

  const formatNumber = (value: number | null | string | any) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' 
      ? parseFloat(value) 
      : Number(value)
    if (isNaN(numValue)) return "-"
    // 使用固定格式，避免 locale 差异
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">-</Badge>
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending: { label: '待处理', variant: 'secondary' },
      confirmed: { label: '已确认', variant: 'default' },
      shipped: { label: '已发货', variant: 'default' },
      delivered: { label: '已交付', variant: 'default' },
      cancelled: { label: '已取消', variant: 'destructive' },
    }
    const statusInfo = statusMap[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 订单基本信息卡片 */}
      <OrderBasicInfoCard
        order={order}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
        getStatusBadge={getStatusBadge}
      />

      {/* 仓点明细表格（可展开显示SKU） */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>仓点明细</CardTitle>
          <CardDescription>订单的仓点信息，点击展开查看每个仓点的SKU明细</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderDetailsTable
            orderId={orderId}
            orderDetails={orderDetails}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}
