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
    inboundReceipt = await prisma.inbound_receipt.findUnique({
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
                unload_type: true,
                volume_percentage: true,
                notes: true,
                order_id: true,
              },
              orderBy: {
                volume_percentage: 'desc',
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
            full_name: true,
            username: true,
          },
        },
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
                unload_type: true,
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
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      notFound()
    }
    throw new Error(`获取入库管理详情失败: ${error?.message || '未知错误'}`)
  }

  if (!inboundReceipt) {
    notFound()
  }

  // 获取所有唯一的 delivery_location（location_id）用于查询 location_code
  const locationIds = inboundReceipt.orders?.order_detail
    ?.map((detail: any) => detail.delivery_location)
    .filter((id: any) => id !== null && id !== undefined)
    .map((id: any) => BigInt(id)) || []
  
  // 批量查询 locations 获取 location_code
  const locationsMap = new Map<string, string>()
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

  // 计算整柜体积（使用 volume 字段）
  const totalContainerVolume = inboundReceipt.orders?.order_detail?.reduce((sum: number, detail: any) => {
    const volume = detail.volume ? Number(detail.volume) : 0;
    return sum + volume;
  }, 0) || 0;

  // 序列化数据
  const serialized = JSON.parse(JSON.stringify(inboundReceipt, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (value instanceof Date) {
      return value.toISOString()
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
                    {inboundReceipt.orders?.order_number || '入库管理详情'}
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
                customer_name: inboundReceipt.orders?.customers?.name || null,
                container_number: inboundReceipt.orders?.order_number || null,
                unloaded_by: serialized.unloaded_by || null,
                received_by: serialized.users_inbound_receipt_received_byTousers?.full_name || null,
                planned_unload_at: serialized.planned_unload_at || null,
                total_container_volume: totalContainerVolume,
              }}
              orderDetails={serialized.orders?.order_detail?.map((detail: any) => {
                // 获取 location_code
                const deliveryLocationCode = detail.delivery_location 
                  ? locationsMap.get(detail.delivery_location.toString()) || detail.delivery_location
                  : null

                return {
                  ...detail,
                  id: detail.id.toString(),
                  order_id: detail.order_id?.toString() || null,
                  volume: detail.volume ? Number(detail.volume) : null,
                  volume_percentage: detail.volume_percentage ? Number(detail.volume_percentage) : null,
                  delivery_location: deliveryLocationCode, // 显示 location_code
                  unload_type: detail.unload_type || null,
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
                  unload_type: lot.order_detail.unload_type || null,
                  volume_percentage: lot.order_detail.volume_percentage ? Number(lot.order_detail.volume_percentage) : null,
                  notes: lot.order_detail.notes || null,
                } : null,
                delivery_location: lot.orders?.delivery_location || null,
              })) || []}
              deliveryAppointments={serialized.orders?.delivery_appointments?.map((appt: any) => ({
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

