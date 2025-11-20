import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trash2 } from "lucide-react"
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

  // 获取客户详情
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

  if (!customer) {
    notFound()
  }

  // 格式化日期
  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("zh-CN")
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
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/customers">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {customer.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                客户代码: {customer.code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CustomerDetailClient
              customer={{
                id: customer.id.toString(),
                code: customer.code,
                name: customer.name,
                company_name: customer.company_name,
                status: customer.status,
                credit_limit: customer.credit_limit?.toString() || null,
                contact: customer.contact_roles
                  ? {
                      name: customer.contact_roles.name,
                      phone: customer.contact_roles.phone,
                      email: customer.contact_roles.email,
                      address_line1: customer.contact_roles.address_line1,
                      address_line2: customer.contact_roles.address_line2,
                      city: customer.contact_roles.city,
                      state: customer.contact_roles.state,
                      postal_code: customer.contact_roles.postal_code,
                      country: customer.contact_roles.country,
                    }
                  : null,
              }}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 基本信息 */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>客户的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">客户代码</p>
                  <p className="text-base font-semibold">{customer.code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">客户名称</p>
                  <p className="text-base font-semibold">{customer.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">公司名称</p>
                  <p className="text-base">{customer.company_name ? customer.company_name : "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">状态</p>
                  <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                    {customer.status === "active" ? "活跃" : "停用"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">信用额度</p>
                  <p className="text-base">
                    {formatCurrency(customer.credit_limit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">创建时间</p>
                  <p className="text-base">{formatDate(customer.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 联系人信息 */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>联系人信息</CardTitle>
              <CardDescription>客户的主要联系人</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.contact_roles ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">联系人姓名</p>
                    <p className="text-base font-semibold">{customer.contact_roles.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">联系电话</p>
                    <p className="text-base">{customer.contact_roles.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">邮箱</p>
                    <p className="text-base">{customer.contact_roles.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">城市</p>
                    <p className="text-base">{customer.contact_roles.city || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">地址</p>
                    <p className="text-base">
                      {[
                        customer.contact_roles.address_line1,
                        customer.contact_roles.address_line2,
                        customer.contact_roles.city,
                        customer.contact_roles.state,
                        customer.contact_roles.postal_code,
                        customer.contact_roles.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">暂无联系人信息</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 最近订单 */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>最近订单</CardTitle>
            <CardDescription>客户的最近订单记录</CardDescription>
          </CardHeader>
          <CardContent>
            {customer.orders && customer.orders.length > 0 ? (
              <div className="space-y-4">
                {customer.orders.map((order) => (
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
      </div>
    </DashboardLayout>
  )
}

