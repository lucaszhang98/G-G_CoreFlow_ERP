"use client"

import * as React from "react"
import { DetailTable, type DetailTableConfig } from "@/components/crud/detail-table"

interface OrderDetailsTableProps {
  orderId: string
  orderDetails: any[]
  onRefresh: () => void
}

export function OrderDetailsTable({
  orderId,
  orderDetails,
  onRefresh,
}: OrderDetailsTableProps) {
  const orderDetailConfig: DetailTableConfig = {
    title: '仓点明细',
    showExpandable: true,
    showColumns: {
      // 按照要求的顺序：送仓地点-性质-数量-体积-预计板数-分仓占比-FBA-备注-PO
      deliveryLocation: true, // 送仓地点
      locationType: true, // 性质（delivery_nature）
      quantity: true, // 数量
      volume: true, // 体积
      estimatedPallets: true, // 预计板数
      volumePercentage: true, // 分仓占比
      unloadType: true, // FBA
      notes: true, // 备注
      po: true, // PO字段
      // 隐藏字段
      detailId: false, // 仓点ID隐藏
      createdAt: false, // 创建时间隐藏
      updatedAt: false, // 更新时间隐藏
    },
  }

  return (
    <DetailTable
      orderId={orderId}
      orderDetails={orderDetails}
      onRefresh={onRefresh}
      config={orderDetailConfig}
    />
  )
}
