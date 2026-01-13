"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface InboundReceiptBasicInfoCardProps {
  inboundReceipt: any
  formatDate: (date: Date | string | null) => string
  formatNumber: (value: number | null | string | any) => string
}

export function InboundReceiptBasicInfoCard({
  inboundReceipt,
  formatDate,
  formatNumber,
}: InboundReceiptBasicInfoCardProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{inboundReceipt.container_number || '入库管理'}</CardTitle>
            <CardDescription className="mt-2">
              入库管理ID: {inboundReceipt.inbound_receipt_id}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 客户信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">客户名称</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.customer_name || "-"}
            </p>
          </div>

          {/* 拆柜人员 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">拆柜人员</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.users_inbound_receipt_unloaded_byTousers?.full_name || 
               inboundReceipt.users_inbound_receipt_unloaded_byTousers?.username || "-"}
            </p>
          </div>

          {/* 柜号 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">柜号</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.container_number || "-"}
            </p>
          </div>

          {/* 入库人员 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">入库人员</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.users_inbound_receipt_received_byTousers?.full_name || 
               inboundReceipt.users_inbound_receipt_received_byTousers?.username || "-"}
            </p>
          </div>

          {/* 拆柜日期 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">拆柜日期</h4>
            <p className="text-sm font-semibold">
              {formatDate(inboundReceipt.planned_unload_at)}
            </p>
          </div>

          {/* 整柜体积 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">整柜体积</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.total_container_volume !== null && inboundReceipt.total_container_volume !== undefined 
                ? Number(inboundReceipt.total_container_volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

