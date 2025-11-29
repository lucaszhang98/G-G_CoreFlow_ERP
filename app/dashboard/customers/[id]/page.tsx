import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityDetail } from "@/components/crud/entity-detail"
import { customerConfig } from "@/lib/crud/configs/customers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"
import { CustomerDetailClient } from "./customer-detail-client"

interface CustomerDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // 处理 params（Next.js 15 中 params 可能是 Promise）
  const resolvedParams = params instanceof Promise ? await params : params

  // 获取客户详情（用于显示最近订单）
  const customer = await prisma.customers.findUnique({
    where: { id: BigInt(resolvedParams.id) },
    include: {
      contact_roles: true,
      orders: {
        take: 10,
        orderBy: { order_date: "desc" },
        select: {
          order_id: true,
          order_number: true,
          order_date: true,
          status: true,
          total_amount: true,
          container_type: true,
          weight: true,
          mbl_number: true,
          do_issued: true,
          eta_date: true,
          lfd_date: true,
          pickup_date: true,
          ready_date: true,
          return_deadline: true,
        },
      },
    },
  })

  // 格式化日期（不包含年份，节省空间）
  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  // 格式化金额
  const formatCurrency = (amount: string | null | Decimal) => {
    if (!amount) return "-"
    const numValue = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    if (isNaN(numValue)) return "-"
    return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 使用框架的详情页，联系人信息作为右侧卡片 */}
            <EntityDetail 
              config={customerConfig} 
              id={resolvedParams.id}
              editComponent={CustomerDetailClient}
              rightCard={
                customer && customer.contact_roles ? (
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>联系人信息</CardTitle>
                      <CardDescription>客户联系人详细信息</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {customer.contact_roles.name && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">姓名</p>
                            <p className="text-base font-semibold">{customer.contact_roles.name}</p>
                          </div>
                        )}
                        {customer.contact_roles.phone && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">电话</p>
                            <p className="text-base font-semibold">{customer.contact_roles.phone}</p>
                          </div>
                        )}
                        {customer.contact_roles.email && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">邮箱</p>
                            <p className="text-base font-semibold">{customer.contact_roles.email}</p>
                          </div>
                        )}
                        {(customer.contact_roles.address_line1 || customer.contact_roles.address_line2 || customer.contact_roles.city || customer.contact_roles.state || customer.contact_roles.postal_code || customer.contact_roles.country) && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">地址</p>
                            <div className="text-base font-semibold space-y-1">
                              {customer.contact_roles.address_line1 && <p>{customer.contact_roles.address_line1}</p>}
                              {customer.contact_roles.address_line2 && <p>{customer.contact_roles.address_line2}</p>}
                              <p>
                                {[customer.contact_roles.city, customer.contact_roles.state, customer.contact_roles.postal_code].filter(Boolean).join(', ')}
                                {customer.contact_roles.country && `, ${customer.contact_roles.country}`}
                              </p>
                            </div>
                          </div>
                        )}
                        {!customer.contact_roles.name && !customer.contact_roles.phone && !customer.contact_roles.email && !customer.contact_roles.address_line1 && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">暂无联系人信息</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : null
              }
            />

            {/* 最近订单（客户管理特有功能） */}
            {customer && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>最近订单</CardTitle>
                  <CardDescription>客户的最近订单记录</CardDescription>
                </CardHeader>
                <CardContent>
                  {customer.orders && customer.orders.length > 0 ? (
                    <div className="space-y-4">
                      {customer.orders.map((order: any) => (
                        <div
                          key={order.order_id.toString()}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">订单号</p>
                              <p className="text-base font-semibold">{order.order_number}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">订单日期</p>
                              <p className="text-base">{formatDate(order.order_date)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">状态</p>
                              <Badge variant="outline">{order.status || "-"}</Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">金额</p>
                              <p className="text-base font-semibold">
                                {formatCurrency(order.total_amount.toString())}
                              </p>
                            </div>
                          </div>
                          <Link href={`/dashboard/oms/orders/${order.order_id}`}>
                            <Button variant="ghost" size="sm">
                              查看详情
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">暂无订单记录</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

