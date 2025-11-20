"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import { formatDate, getStatusBadge, formatCurrency, formatNumber } from "@/lib/utils"

interface SeaContainerDetailProps {
  container: any
}

export function SeaContainerDetail({ container }: SeaContainerDetailProps) {
  const order = container.orders

  if (!order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>海柜容器详情</CardTitle>
          <CardDescription>容器ID: {container.container_id}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">该容器未关联订单</p>
        </CardContent>
      </Card>
    )
  }


  // 获取日期颜色（用于ETA/LFD）
  const getDateColor = (date: Date | string | null, type: 'eta' | 'lfd') => {
    if (!date) return "text-muted-foreground"
    const d = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return "text-red-600 font-semibold" // 已过期
    if (diffDays <= 3) return "text-orange-600 font-semibold" // 即将到期
    return "text-green-600" // 正常
  }

  // 获取提柜司机列表
  const getPickupDrivers = () => {
    const serviceLevel = order.pickup_carrier_service_level
    if (!serviceLevel?.carriers) return "-"
    const drivers = serviceLevel.carriers.drivers
    if (!drivers || drivers.length === 0) return "-"
    return drivers.map((driver: any) => 
      driver.contact_roles?.name || driver.driver_code || `司机${driver.driver_id}`
    ).join(", ")
  }

  // 获取还柜司机列表
  const getReturnDrivers = () => {
    const serviceLevel = order.return_carrier_service_level
    if (!serviceLevel?.carriers) return "-"
    const drivers = serviceLevel.carriers.drivers
    if (!drivers || drivers.length === 0) return "-"
    return drivers.map((driver: any) => 
      driver.contact_roles?.name || driver.driver_code || `司机${driver.driver_id}`
    ).join(", ")
  }

  // 获取码头/查验站（从container_legs的origin_location获取，location_type = 'port'）
  const getPortLocation = () => {
    const leg = container.container_legs?.find((leg: any) => 
      leg.locations_origin?.location_type === 'port'
    )
    return leg?.locations_origin?.name || "-"
  }

  // 获取送货地（从container_legs的destination_location获取）
  const getDestinationLocation = () => {
    const leg = container.container_legs?.[0]
    return leg?.locations_destination?.name || "-"
  }

  // 获取预约同事
  const getAppointmentCreator = () => {
    const appointment = order.delivery_appointments?.[0]
    return appointment?.users_created?.full_name || "-"
  }

  return (
    <div className="space-y-6">
      {/* 容器基本信息 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">海柜容器详情</CardTitle>
              <CardDescription className="mt-2">
                容器ID: {container.container_id} | 状态: {container.status || '-'}
              </CardDescription>
            </div>
            {order && (
              <Link href={`/dashboard/oms/orders/${order.order_id}`}>
                <Button variant="outline">
                  查看订单详情
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 码头提柜大表 - 17个字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 订单信息组 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">订单信息</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">订单号:</span>{" "}
                  {order.order_number ? (
                    <Link 
                      href={`/dashboard/oms/orders/${order.order_id}`}
                      className="text-primary hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  ) : "-"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">客户:</span>{" "}
                  {order.customers?.name || "-"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">订单日期:</span>{" "}
                  {formatDate(order.order_date)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">订单状态:</span>{" "}
                  {getStatusBadge(order.status)}
                </p>
              </div>
            </div>

            {/* 集装箱信息组 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">集装箱信息</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">柜型:</span>{" "}
                  {order.container_type ? (
                    <Badge variant="outline">{order.container_type}</Badge>
                  ) : "-"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">重量:</span>{" "}
                  {order.weight ? `${formatNumber(order.weight)} 吨` : "-"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">MBL:</span>{" "}
                  {order.mbl_number || "-"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">DO:</span>{" "}
                  {order.do_issued ? (
                    <CheckCircle className="inline h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="inline h-4 w-4 text-gray-400" />
                  )}
                </p>
              </div>
            </div>

            {/* 时间信息组 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">时间信息</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">ETA:</span>{" "}
                  <span className={getDateColor(order.eta_date, 'eta')}>
                    {formatDate(order.eta_date)}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">LFD:</span>{" "}
                  <span className={getDateColor(order.lfd_date, 'lfd')}>
                    {formatDate(order.lfd_date)}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">提柜日期:</span>{" "}
                  {formatDate(order.pickup_date)}
                </p>
              </div>
            </div>

            {/* 提柜信息组 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">提柜信息</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">码头/查验站:</span>{" "}
                  {getPortLocation()}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">提柜司机:</span>{" "}
                  {getPickupDrivers()}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">约仓账号:</span>{" "}
                  {order.warehouse_account || "-"}
                </p>
              </div>
            </div>

            {/* 运输信息组 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">运输信息</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">送货地:</span>{" "}
                  {getDestinationLocation()}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">还柜司机:</span>{" "}
                  {getReturnDrivers()}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">预约同事:</span>{" "}
                  {getAppointmentCreator()}
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
    </div>
  )
}

