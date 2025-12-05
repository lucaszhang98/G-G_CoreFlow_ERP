"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface OrderBasicInfoCardProps {
  order: any
  formatDate: (date: Date | string | null) => string
  formatCurrency: (amount: string | number | null | any) => string
  formatNumber: (value: number | null | string | any) => string
  getStatusBadge: (status: string | null) => React.ReactNode
}

export function OrderBasicInfoCard({
  order,
  formatDate,
  formatCurrency,
  formatNumber,
  getStatusBadge,
}: OrderBasicInfoCardProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{order.order_number}</CardTitle>
            <CardDescription className="mt-2">
              订单ID: {order.order_id}
            </CardDescription>
          </div>
          {getStatusBadge(order.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 客户信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">客户信息</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">客户代码:</span>{" "}
                {order.customers?.code || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">客户名称:</span>{" "}
                {order.customers?.name || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">公司名称:</span>{" "}
                {order.customers?.company_name || "-"}
              </p>
            </div>
          </div>

          {/* 订单日期 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">订单日期</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">订单日期:</span>{" "}
                {formatDate(order.order_date)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">预计到达:</span>{" "}
                {formatDate(order.eta_date)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">最后交货:</span>{" "}
                {formatDate(order.lfd_date)}
              </p>
            </div>
          </div>

          {/* 金额信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">金额信息</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">总金额:</span>{" "}
                <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">折扣:</span>{" "}
                {formatCurrency(order.discount_amount)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">税费:</span>{" "}
                {formatCurrency(order.tax_amount)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">最终金额:</span>{" "}
                <span className="font-semibold text-primary">{formatCurrency(order.final_amount)}</span>
              </p>
            </div>
          </div>

          {/* 货柜信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">货柜信息</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">货柜类型:</span>{" "}
                {order.container_type || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">整柜体积:</span>{" "}
                {order.container_volume !== null && order.container_volume !== undefined 
                  ? Number(order.container_volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">MBL号码:</span>{" "}
                {order.mbl_number || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">DO已签发:</span>{" "}
                {order.do_issued ? "是" : "否"}
              </p>
            </div>
          </div>

          {/* 日期信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">重要日期</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">提货日期:</span>{" "}
                {formatDate(order.pickup_date)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">就绪日期:</span>{" "}
                {formatDate(order.ready_date)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">归还截止:</span>{" "}
                {formatDate(order.return_deadline)}
              </p>
            </div>
          </div>

          {/* 其他信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">其他信息</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">仓库账户:</span>{" "}
                {order.warehouse_account || "-"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">创建时间:</span>{" "}
                {formatDate(order.created_at)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">更新时间:</span>{" "}
                {formatDate(order.updated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* 备注 */}
        {order.notes && (
          <>
            <Separator className="my-6" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">备注</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}


