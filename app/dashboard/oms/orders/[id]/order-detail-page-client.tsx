"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getOrderStatusBadge } from "@/lib/utils/badges"
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

  // 格式化日期（不包含年份，节省空间）
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
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

  // 使用统一的订单状态 Badge 函数，确保与配置一致
  const getStatusBadge = (status: string | null) => {
    return getOrderStatusBadge(status)
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
