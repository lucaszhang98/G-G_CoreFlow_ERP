import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { BackButton } from "@/components/ui/back-button"
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
                delivery_location_id: true,
                locations_order_detail_delivery_location_idTolocations: {
                  select: {
                    location_id: true,
                    location_code: true,
                    name: true,
                  },
                },
                fba: true,
                volume_percentage: true,
                notes: true,
                order_id: true,
                appointment_detail_lines: {
                  select: {
                    id: true,
                    estimated_pallets: true,
                    appointment_id: true,
                    delivery_appointments: {
                      select: {
                        appointment_id: true,
                        reference_number: true,
                        confirmed_start: true,
                        location_id: true,
                        status: true,
                        order_id: true,
                      },
                    },
                  },
                  // 不添加 where 条件，查询所有关联的预约明细
                },
              },
              orderBy: {
                volume_percentage: 'desc', // 按分仓占比降序排列
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
        users_inbound_receipt_unloaded_byTousers: {
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
                delivery_location_id: true,
                locations_order_detail_delivery_location_idTolocations: {
                  select: {
                    location_id: true,
                    location_code: true,
                    name: true,
                  },
                },
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
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      notFound()
    }
    
    // 处理 "cached plan must not change result type" 错误（schema 变更后的缓存问题）
    if (error?.message?.includes('cached plan must not change result type')) {
      console.warn('[入库管理详情] 检测到查询计划缓存错误，尝试重新连接并重试...');
      try {
        // 断开并重新连接，清除旧的 prepared statements
        await prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
        await prisma.$connect();
        await new Promise(resolve => setTimeout(resolve, 500)); // 再等待 0.5 秒
        
        // 重试查询
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
                    delivery_location_id: true,
                    locations_order_detail_delivery_location_idTolocations: {
                      select: {
                        location_id: true,
                        location_code: true,
                        name: true,
                      },
                    },
                    fba: true,
                    volume_percentage: true,
                    notes: true,
                    order_id: true,
                    appointment_detail_lines: {
                      select: {
                        id: true,
                        estimated_pallets: true,
                        appointment_id: true,
                        delivery_appointments: {
                          select: {
                            appointment_id: true,
                            reference_number: true,
                            confirmed_start: true,
                            location_id: true,
                            status: true,
                            order_id: true,
                          },
                        },
                      },
                      // 不添加 where 条件，查询所有关联的预约明细
                    },
                  },
                  orderBy: {
                    volume_percentage: 'desc', // 按分仓占比降序排列
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
            users_inbound_receipt_unloaded_byTousers: {
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
                    delivery_location_id: true,
                    locations_order_detail_delivery_location_idTolocations: {
                      select: {
                        location_id: true,
                        location_code: true,
                        name: true,
                      },
                    },
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
        });
        console.log('[入库管理详情] 重新连接后重试成功');
      } catch (retryError: any) {
        console.error('[入库管理详情] 重新连接后重试失败:', retryError);
        throw new Error(`获取入库管理详情失败: ${error?.message || '未知错误'}`);
      }
    } else {
      throw new Error(`获取入库管理详情失败: ${error?.message || '未知错误'}`)
    }
  }

  if (!inboundReceipt) {
    notFound()
  }

  // delivery_location_id 现在有外键约束，关联数据会通过 Prisma include 自动加载
  // 不需要手动查询 locations 了

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
  
  // 调试：检查关联数据
  if (process.env.NODE_ENV === 'development') {
    console.log('[入库管理详情] 关联数据检查:', {
      unloaded_by: serialized.unloaded_by,
      received_by: serialized.received_by,
      users_inbound_receipt_unloaded_byTousers: serialized.users_inbound_receipt_unloaded_byTousers,
      users_inbound_receipt_received_byTousers: serialized.users_inbound_receipt_received_byTousers,
    })
  }

  // 调试：检查预约数据
  const orderNumber = serialized.orders?.order_number || '未知订单'
  console.log(`[入库管理调试] 订单号: ${orderNumber}, 入库管理ID: ${resolvedParams.id}`)
  if (serialized.orders?.order_detail) {
    console.log(`[入库管理调试] 订单明细总数: ${serialized.orders.order_detail.length}`)
    serialized.orders.order_detail.forEach((detail: any, index: number) => {
      const appointmentLinesCount = detail.appointment_detail_lines?.length || 0
      const validAppointmentsCount = (detail.appointment_detail_lines || []).filter((line: any) => 
        line.delivery_appointments !== null && line.delivery_appointments !== undefined
      ).length
      console.log(`[入库管理调试] 订单明细 ${detail.id} (${index + 1}/${serialized.orders.order_detail.length}):`, {
        order_detail_id: detail.id,
        预约明细数量: appointmentLinesCount,
        有效预约数量: validAppointmentsCount,
        预约明细: detail.appointment_detail_lines?.map((line: any) => ({
          id: line.id,
          appointment_id: line.appointment_id,
          has_delivery_appointments: !!line.delivery_appointments,
          reference_number: line.delivery_appointments?.reference_number,
          confirmed_start: line.delivery_appointments?.confirmed_start,
        })) || []
      })
      // 如果没有预约明细，也打印出来
      if (appointmentLinesCount === 0) {
        console.log(`[入库管理调试] ⚠️ 订单明细 ${detail.id} 没有预约明细`)
      }
    })
  } else {
    console.log(`[入库管理调试] ⚠️ 订单没有 order_detail`)
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton fallbackUrl="/dashboard/wms/inbound-receipts" />
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
                unloaded_by: serialized.unloaded_by || null, // 拆柜人员ID
                received_by: serialized.received_by || null, // 入库人员ID
                // 保留关联数据，供前端显示用户名
                users_inbound_receipt_unloaded_byTousers: serialized.users_inbound_receipt_unloaded_byTousers || null,
                users_inbound_receipt_received_byTousers: serialized.users_inbound_receipt_received_byTousers || null,
                planned_unload_at: serialized.planned_unload_at || null,
                total_container_volume: totalContainerVolume,
              }}
              customerCode={inboundReceipt.orders?.customers?.code || undefined}
              orderDetails={serialized.orders?.order_detail?.map((detail: any) => {
                // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
                const deliveryLocationCode = detail.locations_order_detail_delivery_location_idTolocations?.location_code || null

                // 计算该明细的体积（从 order_detail.volume 获取）
                const detailVolume = detail.volume ? Number(detail.volume) : null
                
                // 从 appointment_detail_lines 提取预约信息
                const rawAppointmentLines = detail.appointment_detail_lines || []
                console.log(`[入库管理调试] 订单明细 ${detail.id} 原始预约明细数量: ${rawAppointmentLines.length}`)
                
                const appointments = rawAppointmentLines.map((line: any) => {
                  // 调试：检查数据结构
                  if (!line.delivery_appointments) {
                    console.warn(`[入库管理] 订单明细 ${detail.id} 的预约明细 ${line.id} 没有关联的 delivery_appointments`, {
                      line_id: line.id,
                      appointment_id: line.appointment_id,
                      estimated_pallets: line.estimated_pallets,
                    })
                  } else {
                    console.log(`[入库管理调试] ✅ 订单明细 ${detail.id} 的预约明细 ${line.id} 有 delivery_appointments:`, {
                      appointment_id: line.delivery_appointments.appointment_id,
                      reference_number: line.delivery_appointments.reference_number,
                    })
                  }
                  return {
                    appointment_id: line.delivery_appointments?.appointment_id?.toString() || null,
                    reference_number: line.delivery_appointments?.reference_number || null,
                    confirmed_start: line.delivery_appointments?.confirmed_start || null,
                    location_id: line.delivery_appointments?.location_id?.toString() || null,
                    status: line.delivery_appointments?.status || null,
                    order_id: line.delivery_appointments?.order_id?.toString() || null,
                    estimated_pallets: line.estimated_pallets || 0,
                  }
                })
                
                const validAppointments = appointments.filter((appt: any) => appt.appointment_id !== null)
                console.log(`[入库管理调试] 订单明细 ${detail.id} 提取后有效预约数量: ${validAppointments.length}/${appointments.length}`)
                
                // 调试：检查是否有预约
                if (rawAppointmentLines.length > 0 && validAppointments.length === 0) {
                  console.warn(`[入库管理] ⚠️ 订单明细 ${detail.id} 有 ${rawAppointmentLines.length} 条预约明细，但提取后为0`, rawAppointmentLines)
                }
                
                // 使用过滤后的有效预约
                const finalAppointments = validAppointments
                
                return {
                  ...detail,
                  id: detail.id.toString(),
                  order_id: detail.order_id?.toString() || null,
                  volume: detailVolume,
                  container_volume: detailVolume, // 明细的体积就是 container_volume（用于显示）
                  volume_percentage: detail.volume_percentage ? Number(detail.volume_percentage) : null,
                  delivery_location: deliveryLocationCode, // 显示 location_code
                  fba: detail.fba || null,
                  notes: detail.notes || null,
                  appointments: finalAppointments, // 添加预约信息
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
                  delivery_location: lot.order_detail.locations_order_detail_delivery_location_idTolocations?.location_code || null,
                  fba: lot.order_detail.fba || null,
                  volume_percentage: lot.order_detail.volume_percentage ? Number(lot.order_detail.volume_percentage) : null,
                  notes: lot.order_detail.notes || null,
                } : null,
                delivery_location: lot.orders?.delivery_location || null,
              })) || []}
              inboundReceiptId={resolvedParams.id}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

