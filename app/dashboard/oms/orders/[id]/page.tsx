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
      select: {
        order_id: true,
        order_number: true,
        customer_id: true,
        user_id: true,
        order_date: true,
        status: true,
        total_amount: true,
        discount_amount: true,
        tax_amount: true,
        final_amount: true,
        notes: true,
        eta_date: true,
        lfd_date: true,
        pickup_date: true,
        ready_date: true,
        return_deadline: true,
        container_type: true,
        container_volume: true, // 从数据库读取，但也会根据 order_detail 计算以确保一致性
        mbl_number: true,
        do_issued: true,
        warehouse_account: true,
        port_location: true,
        operation_mode: true,
        delivery_location: true,
        carrier_id: true,
        appointment_time: true,
        created_at: true,
        updated_at: true,
        created_by: true,
        updated_by: true,
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
            company_name: true,
          },
        },
        carriers: {
          select: {
            carrier_id: true,
            name: true,
            carrier_code: true,
          },
        },
        users_orders_user_idTousers: {
          select: {
            id: true,
            full_name: true,
          },
        },
        order_detail: {
          select: {
            id: true,
            order_id: true,
            detail_id: true,
            quantity: true,
            volume: true,
            estimated_pallets: true,
            delivery_nature: true,
            delivery_location: true,
            fba: true,
            volume_percentage: true,
            notes: true,
            po: true, // PO字段
            created_at: true,
            updated_at: true,
            created_by: true,
            updated_by: true,
            remaining_pallets: true,
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
          orderBy: {
            volume_percentage: 'desc', // 默认按分仓占比降序排列
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

  // 计算整柜体积：从 order_detail 的 volume 总和得出（覆盖数据库中的旧值）
  let containerVolume = 0
  if (order.order_detail && Array.isArray(order.order_detail)) {
    const volumes: number[] = []
    containerVolume = order.order_detail.reduce((sum: number, detail: any) => {
      // 确保 volume 是数字类型，处理 Decimal 类型和字符串
      let volume = 0
      if (detail.volume !== null && detail.volume !== undefined) {
        if (typeof detail.volume === 'object' && 'toString' in detail.volume) {
          // Decimal 类型
          volume = parseFloat(detail.volume.toString()) || 0
        } else if (typeof detail.volume === 'string') {
          volume = parseFloat(detail.volume) || 0
        } else {
          volume = Number(detail.volume) || 0
        }
      }
      volumes.push(volume)
      return sum + volume
    }, 0)
    // 开发环境：输出计算日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OrderDetailPage] 订单 ${order.order_id} 整柜体积计算:`, {
        detailCount: order.order_detail.length,
        volumes,
        calculatedTotal: containerVolume,
      })
    }

    // 获取所有唯一的 delivery_location（可能是 location_id 或 location_code）
    const deliveryLocations = order.order_detail
      .map((detail: any) => detail.delivery_location)
      .filter((loc: any) => loc !== null && loc !== undefined)
    
    // 批量查询 locations 获取 location_code
    const locationsMap = new Map<string, string>()
    if (deliveryLocations.length > 0) {
      // 分离数字类型的 location_id 和字符串类型的 location_code
      const numericIds: bigint[] = []
      const stringCodes: string[] = []
      
      deliveryLocations.forEach((loc: any) => {
        // 检查是否为数字（location_id）
        if (typeof loc === 'number' || (typeof loc === 'string' && !isNaN(Number(loc)) && loc.trim() !== '')) {
          try {
            numericIds.push(BigInt(loc))
          } catch (e) {
            // 如果转换失败，可能是 location_code
            stringCodes.push(String(loc))
          }
        } else {
          // 字符串类型，可能是 location_code
          stringCodes.push(String(loc))
        }
      })
      
      // 查询数字类型的 location_id
      if (numericIds.length > 0) {
        const locationsById = await prisma.locations.findMany({
          where: {
            location_id: {
              in: numericIds,
            },
          },
          select: {
            location_id: true,
            location_code: true,
          },
        })
        
        locationsById.forEach((loc: any) => {
          locationsMap.set(loc.location_id.toString(), loc.location_code || '')
        })
      }
      
      // 查询字符串类型的 location_code
      if (stringCodes.length > 0) {
        const locationsByCode = await prisma.locations.findMany({
          where: {
            location_code: {
              in: stringCodes,
            },
          },
          select: {
            location_id: true,
            location_code: true,
          },
        })
        
        locationsByCode.forEach((loc: any) => {
          // 使用 location_code 作为 key（因为 delivery_location 存储的是 code）
          locationsMap.set(loc.location_code || '', loc.location_code || '')
          // 同时也用 location_id 作为 key（以防万一）
          locationsMap.set(loc.location_id.toString(), loc.location_code || '')
        })
      }
    }

    // 为每个明细计算预计板数和分仓占比（覆盖数据库中的值）
    order.order_detail = order.order_detail.map((detail: any) => {
      let volumeNum = 0
      if (detail.volume !== null && detail.volume !== undefined) {
        if (typeof detail.volume === 'object' && 'toString' in detail.volume) {
          volumeNum = parseFloat(detail.volume.toString()) || 0
        } else if (typeof detail.volume === 'string') {
          volumeNum = parseFloat(detail.volume) || 0
        } else {
          volumeNum = Number(detail.volume) || 0
        }
      }
      
      // 计算预计板数：体积除以2后四舍五入，最小值为1
      const calculatedEstimatedPallets = volumeNum > 0 ? Math.max(1, Math.round(volumeNum / 2)) : null
      
      // 计算分仓占比：当前体积除以总体积的百分比
      const calculatedVolumePercentage = containerVolume > 0 && volumeNum > 0 
        ? parseFloat(((volumeNum / containerVolume) * 100).toFixed(2)) 
        : null

      // 获取 location_code
      // delivery_location 可能是 location_id（数字）或 location_code（字符串）
      let deliveryLocationCode: string | null = null
      if (detail.delivery_location) {
        const locKey = detail.delivery_location.toString()
        // 先尝试用原值作为 key 查找
        deliveryLocationCode = locationsMap.get(locKey) || null
        // 如果找不到，且原值是字符串，可能原值就是 location_code
        if (!deliveryLocationCode && typeof detail.delivery_location === 'string') {
          // 检查是否已经是 location_code（在 locationsMap 中作为 key 存在）
          if (locationsMap.has(detail.delivery_location)) {
            deliveryLocationCode = detail.delivery_location
          }
        }
      }

      return {
        ...detail,
        estimated_pallets: calculatedEstimatedPallets,
        volume_percentage: calculatedVolumePercentage,
        delivery_location_code: deliveryLocationCode, // 添加 location_code 字段
      }
    })
  }
  // container_volume 从数据库读取，但如果计算值与数据库值不一致，使用计算值（确保数据一致性）
  const dbContainerVolume = order.container_volume ? Number(order.container_volume) : 0
  if (Math.abs(dbContainerVolume - containerVolume) > 0.01) {
    // 如果差异较大，使用计算值（但不在详情页更新数据库，由 API 处理）
    ;(order as any).container_volume = containerVolume
  } else {
    // 如果差异很小，使用数据库值
    ;(order as any).container_volume = dbContainerVolume
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
                delivery_location: detail.delivery_location_code || detail.delivery_location || null, // 优先使用 location_code
                location_code: detail.delivery_location_code || null, // 添加 location_code 字段供 detail-table 使用
                fba: detail.fba || null,
                volume_percentage: detail.volume_percentage ? Number(detail.volume_percentage) : null,
                notes: detail.notes || null,
                po: detail.po || null, // PO字段
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

