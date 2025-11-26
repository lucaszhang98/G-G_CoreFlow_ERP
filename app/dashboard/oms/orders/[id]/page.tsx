import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"
import { OrderDetailPageClient } from "./order-detail-page-client"
import { getOrderStatusBadge } from "@/lib/utils/badges"

interface OrderDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = params instanceof Promise ? await params : params

  // 验证ID是否有效
  if (!resolvedParams.id || isNaN(Number(resolvedParams.id))) {
    notFound()
  }

  // 获取订单详情，包含三层数据
  let order
  try {
    order = await prisma.orders.findUnique({
      where: { order_id: BigInt(resolvedParams.id) },
    include: {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
          company_name: true,
        },
      },
      order_detail: {
        include: {
          // 一个仓点可以有多个SKU（通过 order_detail_item.detail_id 指向 order_detail.id）
          order_detail_item_order_detail_item_detail_idToorder_detail: {
            select: {
              id: true,
              detail_name: true,
              sku: true,
              description: true,
              stock_quantity: true,
              volume: true,
              status: true,
              fba: true,
              detail_id: true,
              created_at: true,
              updated_at: true,
              created_by: true,
              updated_by: true,
            },
          },
        },
      },
    },
  })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      notFound()
    }
    throw new Error(`获取订单详情失败: ${error?.message || '未知错误'}`)
  }

  if (!order) {
    notFound()
  }

  // 格式化日期（不包含年份，节省空间）
  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  const formatCurrency = (amount: string | null | Decimal) => {
    if (!amount) return "-"
    const numValue = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    if (isNaN(numValue)) return "-"
    return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatNumber = (value: number | null | string | Decimal) => {
    if (!value && value !== 0) return "-"
    const numValue = value instanceof Decimal 
      ? Number(value) 
      : typeof value === 'string' 
        ? parseFloat(value) 
        : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  // 获取状态标签
  // 使用统一的订单状态 Badge 函数，确保与配置一致
  const getStatusBadge = (status: string | null) => {
    return getOrderStatusBadge(status)
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/oms/orders">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {order.order_number}
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    订单ID: {order.order_id.toString()}
                  </p>
                </div>
              </div>
            </div>

            {/* 订单详情（标签页设计） */}
            <OrderDetailPageClient
              order={JSON.parse(JSON.stringify(order, (key, value) => {
                if (typeof value === 'bigint') {
                  return value.toString()
                }
                if (value instanceof Date) {
                  return value.toISOString()
                }
                return value
              }))}
              orderDetails={JSON.parse(JSON.stringify(order.order_detail, (key, value) => {
                if (typeof value === 'bigint') {
                  return value.toString()
                }
                if (value instanceof Date) {
                  return value.toISOString()
                }
                return value
              })).map((detail: any) => ({
                ...detail,
                id: detail.id.toString(),
                order_id: detail.order_id?.toString() || null,
                detail_id: detail.detail_id?.toString() || null,
                volume: detail.volume ? Number(detail.volume) : null,
                container_volume: detail.container_volume ? Number(detail.container_volume) : null,
                order_detail_item_order_detail_item_detail_idToorder_detail: (detail.order_detail_item_order_detail_item_detail_idToorder_detail || []).map((item: any) => ({
                  ...item,
                  id: item.id.toString(),
                  volume: item.volume ? Number(item.volume) : null,
                  detail_id: item.detail_id ? item.detail_id.toString() : null,
                  created_by: item.created_by ? item.created_by.toString() : null,
                  updated_by: item.updated_by ? item.updated_by.toString() : null,
                })),
                created_at: detail.created_at,
                updated_at: detail.updated_at,
                created_by: detail.created_by ? detail.created_by.toString() : null,
                updated_by: detail.updated_by ? detail.updated_by.toString() : null,
              }))}
              orderId={resolvedParams.id}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

