import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取订单的明细和库存信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { orderId: orderIdStr } = await params
    const orderId = BigInt(orderIdStr)
    
    // 获取预约ID（如果提供了）
    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')
    
    // 如果提供了 appointmentId，获取预约的目的地信息
    let appointmentDestinationLocationId: string | null = null
    let appointmentDestinationLocationCode: string | null = null
    if (appointmentId) {
      try {
        const appointment = await prisma.delivery_appointments.findUnique({
          where: { appointment_id: BigInt(appointmentId) },
          select: {
            location_id: true,
            locations: {
              select: {
                location_id: true,
                location_code: true,
              },
            },
          },
        })
        if (appointment?.location_id) {
          appointmentDestinationLocationId = appointment.location_id.toString()
          appointmentDestinationLocationCode = appointment.locations?.location_code || null
        }
      } catch (error) {
        console.warn('获取预约目的地信息失败:', error)
        // 不阻止继续执行，只是没有目的地验证
      }
    }

    // 获取订单信息（包含入库管理记录ID）
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId },
      select: {
        order_id: true,
        order_number: true,
        delivery_location: true,
        inbound_receipt: {
          select: {
            inbound_receipt_id: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 获取订单明细
    const orderDetails = await prisma.order_detail.findMany({
      where: { order_id: orderId },
      select: {
        id: true,
        quantity: true,
        volume: true,
        estimated_pallets: true,
        remaining_pallets: true, // 未约板数（预计板数 - 所有预约板数之和）
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
        po: true, // PO字段
        order_detail_item_order_detail_item_detail_idToorder_detail: {
          select: {
            id: true,
            detail_name: true,
          },
          take: 1,
        },
      },
    })

    console.log(`[预约明细API] 订单 ${orderId} 查询到的明细数量: ${orderDetails.length}`)
    if (orderDetails.length > 0) {
      console.log(`[预约明细API] 明细示例:`, {
        id: orderDetails[0].id,
        delivery_location_id: orderDetails[0].delivery_location_id,
        location_code: orderDetails[0].locations_order_detail_delivery_location_idTolocations?.location_code,
        delivery_nature: orderDetails[0].delivery_nature,
      })
    }

    // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
    // 不需要手动查询 locations 了

    // 检查每个明细是否在库存中，并获取库存板数
    console.log(`[预约明细API] 开始处理 ${orderDetails.length} 个明细`)
    const detailsWithInventory = await Promise.all(
      orderDetails.map(async (detail) => {
        // 查询该明细的库存
        const inventoryLots = await prisma.inventory_lots.findMany({
          where: {
            order_id: orderId,
            order_detail_id: detail.id,
          },
          select: {
            pallet_count: true,
            unbooked_pallet_count: true, // 未约板数
            remaining_pallet_count: true,
          },
        })

        // 计算总库存板数
        const totalInventoryPallets = inventoryLots.reduce(
          (sum, lot) => sum + (Number(lot.pallet_count) || 0),
          0
        )

        const hasInventory = inventoryLots.length > 0 && totalInventoryPallets > 0

        // 实时计算未约板数：有效占用 = estimated_pallets - rejected_pallets
        const appointmentLines = await prisma.appointment_detail_lines.findMany({
          where: { order_detail_id: detail.id },
          select: { estimated_pallets: true, rejected_pallets: true },
        })
        const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
        const totalEffectivePallets = appointmentLines.reduce(
          (sum, line) => sum + effective(line.estimated_pallets, line.rejected_pallets),
          0
        )

        // 未约板数 = 预计/实际板数 - 有效占用
        const unbookedPallets = hasInventory
          ? (totalInventoryPallets - totalEffectivePallets)
          : ((detail.estimated_pallets || 0) - totalEffectivePallets)

        // 获取 location_code（从关联数据中获取）
        const locationCode = detail.locations_order_detail_delivery_location_idTolocations?.location_code || null
        
        // 检查送仓地点是否与预约目的地一致
        let matchesAppointmentDestination = false
        if (appointmentDestinationLocationId && detail.delivery_location_id) {
          // 比较 location_id（需要转换为相同类型）
          // detail.delivery_location_id 是 bigint，appointmentDestinationLocationId 是 string
          const detailLocationId = typeof detail.delivery_location_id === 'bigint' 
            ? detail.delivery_location_id.toString() 
            : String(detail.delivery_location_id)
          const appointmentLocationId = appointmentDestinationLocationId // 已经是 string
          if (detailLocationId === appointmentLocationId) {
            matchesAppointmentDestination = true
          } else if (locationCode && appointmentDestinationLocationCode) {
            // 比较 location_code
            matchesAppointmentDestination = locationCode === appointmentDestinationLocationCode
          }
        }

        const result = {
          id: detail.id.toString(),
          quantity: detail.quantity,
          volume: detail.volume ? Number(detail.volume) : null,
          estimated_pallets: detail.estimated_pallets,
          remaining_pallets: unbookedPallets, // 未约板数（已入库用 inventory_lots.unbooked_pallet_count，未入库用 order_detail.remaining_pallets）
          unbooked_pallets: unbookedPallets, // 未约板数（已入库用 inventory_lots.unbooked_pallet_count，未入库用 order_detail.remaining_pallets）
          delivery_nature: detail.delivery_nature,
          delivery_location: locationCode, // 使用 location_code 作为 delivery_location
          location_code: locationCode,
          fba: detail.fba || null,
          volume_percentage: detail.volume_percentage ? Number(detail.volume_percentage) : null,
          notes: detail.notes || null,
          po: detail.po || null, // PO字段
          has_inventory: hasInventory,
          inventory_pallets: hasInventory ? totalInventoryPallets : null,
          // 新增：送仓地点与预约目的地一致性标记
          matches_appointment_destination: matchesAppointmentDestination,
          appointment_destination_location_code: appointmentDestinationLocationCode,
        }
        
        // 调试：如果 location_code 为空，记录警告
        if (!locationCode) {
          console.warn(`[预约明细API] 订单明细 ${detail.id} 的 location_code 为空，delivery_location_id: ${detail.delivery_location_id}`)
        }
        
        return result
      })
    )

    console.log(`[预约明细API] 处理完成，返回 ${detailsWithInventory.length} 个明细`)

    return NextResponse.json({
      success: true,
      data: {
        order: {
          order_id: order.order_id.toString(),
          order_number: order.order_number,
          delivery_location: order.delivery_location,
          inbound_receipt_id: order.inbound_receipt?.inbound_receipt_id?.toString() || null,
        },
        details: detailsWithInventory,
        // 新增：预约目的地信息（如果提供了 appointmentId）
        appointment_destination: appointmentDestinationLocationId ? {
          location_id: appointmentDestinationLocationId,
          location_code: appointmentDestinationLocationCode,
        } : null,
      },
    })
  } catch (error: any) {
    console.error('获取订单明细失败:', error)
    return NextResponse.json(
      { error: '获取订单明细失败', message: error.message },
      { status: 500 }
    )
  }
}

