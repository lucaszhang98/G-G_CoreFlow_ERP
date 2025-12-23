import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { InboundReceiptDetailPageClient } from "./inbound-receipt-detail-page-client"

interface InboundReceiptDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function InboundReceiptDetailPage({ params }: InboundReceiptDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = params instanceof Promise ? await params : params

  // 验证ID是否有效
  if (!resolvedParams.id || isNaN(Number(resolvedParams.id))) {
    notFound()
  }

  // 获取入库管理详情
  let inboundReceipt
  try {
    inboundReceipt = await (prisma.inbound_receipt.findUnique as any)({
      where: { inbound_receipt_id: BigInt(resolvedParams.id) },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            eta_date: true,
            ready_date: true,
            lfd_date: true,
            pickup_date: true,
            customers: {
              select: {
                id: true,
                code: true,
                name: true,
                company_name: true,
              },
            },
            order_detail: {
              select: {
                id: true,
                quantity: true,
                volume: true,
                estimated_pallets: true,
                delivery_nature: true,
                delivery_location: true,
                fba: true,
                volume_percentage: true,
                notes: true,
                order_id: true,
              },
              orderBy: {
                volume_percentage: 'desc', // 按分仓占比降序排列
              },
            },
            delivery_appointments: {
              select: {
                appointment_id: true,
                reference_number: true,
                confirmed_start: true,
                location_id: true,
                status: true,
              },
            },
          },
        },
        users_inbound_receipt_received_byTousers: {
          select: {
            id: true,
            name: true,
            username: true,
          } as any,
        },
        users_inbound_receipt_unloaded_byTousers: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        } as any,
        warehouses: {
          select: {
            warehouse_id: true,
            name: true,
            warehouse_code: true,
          },
        },
        unload_methods: {
          select: {
            method_code: true,
            description: true,
          },
        },
        inventory_lots: {
          select: {
            inventory_lot_id: true,
            order_detail_id: true,
            storage_location_code: true,
            pallet_count: true,
            remaining_pallet_count: true,
            unbooked_pallet_count: true,
            delivery_progress: true,
            order_detail: {
              select: {
                id: true,
                delivery_nature: true,
                delivery_location: true,
                fba: true,
                volume: true,
                estimated_pallets: true,
                volume_percentage: true,
                notes: true,
              },
            },
            orders: {
              select: {
                delivery_location: true,
              },
            },
          },
        },
      },
    } as any)
  } catch (error: any) {
    if (error?.code === 'P2025') {
      notFound()
    }
    throw new Error(`获取入库管理详情失败: ${error?.message || '未知错误'}`)
  }

  if (!inboundReceipt) {
    notFound()
  }

  // 获取所有唯一的 delivery_location 用于查询 location_code
  // delivery_location 可能是 location_id（数字字符串）或 location_code（字符串）
  const deliveryLocations = (inboundReceipt as any).orders?.order_detail
    ?.map((detail: any) => detail.delivery_location)
    .filter((id: any) => id !== null && id !== undefined) || []
  
  // 分离数字字符串（location_id）和非数字字符串（location_code）
  const locationIds: bigint[] = []
  const locationCodes: string[] = []
  
  deliveryLocations.forEach((loc: any) => {
    const locStr = String(loc)
    // 判断是否为数字字符串
    if (/^\d+$/.test(locStr)) {
      locationIds.push(BigInt(locStr))
    } else {
      locationCodes.push(locStr)
    }
  })
  
  // 批量查询 locations 获取 location_code
  const locationsMap = new Map<string, string>()
  
  // 通过 location_id 查询
  if (locationIds.length > 0) {
    const locations = await prisma.locations.findMany({
      where: {
        location_id: {
          in: locationIds,
        },
      },
      select: {
        location_id: true,
        location_code: true,
      },
    })
    
    locations.forEach((loc: any) => {
      locationsMap.set(loc.location_id.toString(), loc.location_code || '')
    })
  }
  
  // 通过 location_code 查询（如果 delivery_location 本身就是 location_code）
  if (locationCodes.length > 0) {
    const locations = await prisma.locations.findMany({
      where: {
        location_code: {
          in: locationCodes,
        },
      },
      select: {
        location_id: true,
        location_code: true,
      },
    })
    
    locations.forEach((loc: any) => {
      // 将 location_code 映射到 location_code（用于显示）
      locationsMap.set(loc.location_code || '', loc.location_code || '')
      // 同时也将 location_id 映射到 location_code
      locationsMap.set(loc.location_id.toString(), loc.location_code || '')
    })
  }

  // 计算整柜体积（使用 volume 字段）
  const totalContainerVolume = (inboundReceipt as any).orders?.order_detail?.reduce((sum: number, detail: any) => {
    // 处理 Prisma Decimal 类型
    const volume = detail.volume 
      ? (typeof detail.volume === 'object' && 'toNumber' in detail.volume 
          ? (detail.volume as any).toNumber() 
          : Number(detail.volume))
      : 0;
    return sum + volume;
  }, 0) || 0;

  // 在序列化之前，先处理 Prisma Decimal 类型
  // 手动转换 order_detail 中的 Decimal 字段
  if ((inboundReceipt as any).orders?.order_detail) {
    (inboundReceipt as any).orders.order_detail = (inboundReceipt as any).orders.order_detail.map((detail: any) => {
      const processed: any = { ...detail }
      // 处理 volume（Decimal 类型）
      if (detail.volume && typeof detail.volume === 'object' && 'toNumber' in detail.volume) {
        processed.volume = (detail.volume as any).toNumber()
      }
      // 处理 volume_percentage（Decimal 类型）
      // 注意：Prisma Decimal 类型即使值为 null，也可能返回一个对象
      // 需要尝试调用 toNumber() 来判断实际值
      if (detail.volume_percentage !== null && detail.volume_percentage !== undefined) {
        if (typeof detail.volume_percentage === 'object' && 'toNumber' in detail.volume_percentage) {
          try {
            const numValue = (detail.volume_percentage as any).toNumber()
            // 如果 toNumber() 返回 null、undefined 或 NaN，则保持 null
            processed.volume_percentage = (numValue !== null && numValue !== undefined && !isNaN(numValue)) ? numValue : null
          } catch (e) {
            // 如果 toNumber() 失败，尝试其他方式
            processed.volume_percentage = null
          }
        } else if (typeof detail.volume_percentage === 'number') {
          processed.volume_percentage = isNaN(detail.volume_percentage) ? null : detail.volume_percentage
        } else if (typeof detail.volume_percentage === 'string') {
          const numValue = parseFloat(detail.volume_percentage)
          processed.volume_percentage = isNaN(numValue) ? null : numValue
        } else {
          processed.volume_percentage = null
        }
      } else {
        // 保持 null 或 undefined
        processed.volume_percentage = null
      }
      return processed
    })
  }

  // 序列化数据
  const serialized = JSON.parse(JSON.stringify(inboundReceipt, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    // 处理 Prisma Decimal 类型（作为备用，如果上面没有处理到）
    if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
      return (value as any).toNumber()
    }
    return value
  }))

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/wms/inbound-receipts">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {(inboundReceipt as any).orders?.order_number || '入库管理详情'}
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    入库管理ID: {inboundReceipt.inbound_receipt_id.toString()}
                  </p>
                </div>
              </div>
            </div>

            {/* 入库管理详情 */}
            <InboundReceiptDetailPageClient
              inboundReceipt={{
                ...serialized,
                customer_name: (inboundReceipt as any).orders?.customers?.name || null,
                container_number: (inboundReceipt as any).orders?.order_number || null,
                unloaded_by: serialized.users_inbound_receipt_unloaded_byTousers?.name || null,
                received_by: serialized.users_inbound_receipt_received_byTousers?.name || null,
                planned_unload_at: serialized.planned_unload_at || null,
                total_container_volume: totalContainerVolume,
              }}
              customerCode={(inboundReceipt as any).orders?.customers?.code || null}
              orderDetails={(serialized.orders as any)?.order_detail?.map((detail: any) => {
                // 获取 location_code
                // delivery_location 可能是 location_id（数字字符串）或 location_code（字符串）
                let deliveryLocationCode: string | null = null
                if (detail.delivery_location) {
                  const locStr = String(detail.delivery_location)
                  // 先尝试直接查找（如果是 location_code）
                  deliveryLocationCode = locationsMap.get(locStr) || null
                  // 如果不是，且是数字字符串，尝试通过 location_id 查找
                  if (!deliveryLocationCode && /^\d+$/.test(locStr)) {
                    deliveryLocationCode = locationsMap.get(locStr) || null
                  }
                  // 如果还是找不到，使用原值（可能是 location_code）
                  if (!deliveryLocationCode) {
                    deliveryLocationCode = locStr
                  }
                }

                // 计算该明细的体积（从 order_detail.volume 获取）
                const detailVolume = detail.volume ? Number(detail.volume) : null
                
                // 处理 volume_percentage（序列化后可能是字符串或数字）
                // 注意：Prisma Decimal 类型在序列化后可能变成字符串
                let volumePercentage: number | null = null
                if (detail.volume_percentage !== undefined && detail.volume_percentage !== null) {
                  // 处理各种可能的情况：字符串、数字、Decimal 对象
                  let percentageValue: number
                  if (typeof detail.volume_percentage === 'string') {
                    percentageValue = parseFloat(detail.volume_percentage)
                  } else if (typeof detail.volume_percentage === 'number') {
                    percentageValue = detail.volume_percentage
                  } else if (detail.volume_percentage && typeof detail.volume_percentage === 'object' && 'toNumber' in detail.volume_percentage) {
                    percentageValue = (detail.volume_percentage as any).toNumber()
                  } else {
                    percentageValue = Number(detail.volume_percentage)
                  }
                  volumePercentage = isNaN(percentageValue) ? null : percentageValue
                }
                
                // 如果 volume_percentage 为 null，但 detailVolume 和 totalContainerVolume 都有值，则动态计算
                if (volumePercentage === null && detailVolume !== null && detailVolume > 0 && totalContainerVolume > 0) {
                  volumePercentage = (detailVolume / totalContainerVolume) * 100
                }
                
                return {
                  ...detail,
                  id: detail.id.toString(),
                  order_id: detail.order_id?.toString() || null,
                  quantity: detail.quantity !== undefined && detail.quantity !== null ? Number(detail.quantity) : 0,
                  volume: detailVolume,
                  container_volume: detailVolume, // 明细的体积就是 container_volume（用于显示）
                  volume_percentage: volumePercentage,
                  delivery_location: deliveryLocationCode, // 显示 location_code
                  delivery_nature: detail.delivery_nature || null, // 性质字段
                  fba: detail.fba || null,
                  notes: detail.notes || null,
                }
              }) || []}
              inventoryLots={serialized.inventory_lots?.map((lot: any) => ({
                ...lot,
                inventory_lot_id: lot.inventory_lot_id.toString(),
                order_detail_id: lot.order_detail_id.toString(),
                pallet_count: lot.pallet_count || 0,
                remaining_pallet_count: lot.remaining_pallet_count || 0,
                unbooked_pallet_count: lot.unbooked_pallet_count || 0,
                delivery_progress: lot.delivery_progress ? Number(lot.delivery_progress) : null,
                order_detail: lot.order_detail ? {
                  ...lot.order_detail,
                  id: lot.order_detail.id.toString(),
                  volume: lot.order_detail.volume ? Number(lot.order_detail.volume) : null,
                  delivery_location: lot.order_detail.delivery_location || null,
                  fba: lot.order_detail.fba || null,
                  volume_percentage: lot.order_detail.volume_percentage ? Number(lot.order_detail.volume_percentage) : null,
                  notes: lot.order_detail.notes || null,
                } : null,
                delivery_location: lot.orders?.delivery_location || null,
              })) || []}
              deliveryAppointments={(serialized.orders as any)?.delivery_appointments?.map((appt: any) => ({
                ...appt,
                appointment_id: appt.appointment_id.toString(),
                order_id: serialized.orders?.order_id?.toString() || null,
              })) || []}
              inboundReceiptId={resolvedParams.id}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

