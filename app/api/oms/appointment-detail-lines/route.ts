import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// GET - 获取预约明细列表（根据 appointment_id）
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')

    if (!appointmentId) {
      return NextResponse.json({ error: '缺少 appointmentId 参数' }, { status: 400 })
    }

    // 获取预约的所有明细
    const appointmentDetailLines = await prisma.appointment_detail_lines.findMany({
      where: {
        appointment_id: BigInt(appointmentId),
      },
      include: {
        order_detail: {
          select: {
            id: true,
            order_id: true,
            detail_id: true,
            quantity: true,
            volume: true,
            estimated_pallets: true, // 总板数
            remaining_pallets: true, // 剩余板数
            delivery_nature: true,
            delivery_location: true,
            unload_type: true,
            volume_percentage: true,
            notes: true,
            po: true, // PO字段
            orders: {
              select: {
                order_id: true,
                order_number: true,
              },
            },
            order_detail_item_order_detail_item_detail_idToorder_detail: {
              select: {
                id: true,
                detail_name: true,
                sku: true,
                description: true,
              },
            },
          },
        },
        delivery_appointments: {
          select: {
            reference_number: true,
          },
        },
      },
    })

    // 获取 locations 数据，用于将 delivery_location (location_id) 转换为 location_code
    const locationIds = appointmentDetailLines
      .map(line => line.order_detail.delivery_location)
      .filter((loc): loc is string => !!loc && !isNaN(Number(loc)))
      .map(loc => BigInt(loc))

    let locationsMap = new Map<string, string>()
    if (locationIds.length > 0) {
      try {
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

        locations.forEach(loc => {
          locationsMap.set(loc.location_id.toString(), loc.location_code || '')
        })
      } catch (error) {
        console.error('获取 locations 失败:', error)
      }
    }

    // 获取所有 order_detail_id，用于查询库存
    const orderDetailIds = appointmentDetailLines.map(line => line.order_detail_id)
    const inventoryLots = await prisma.inventory_lots.findMany({
      where: {
        order_detail_id: {
          in: orderDetailIds,
        },
      },
      select: {
        order_detail_id: true,
        pallet_count: true,
        unbooked_pallet_count: true,
      },
    })
    
    // 创建库存映射（order_detail_id -> inventory_lot）
    const inventoryMap = new Map<bigint, { pallet_count: number; unbooked_pallet_count: number | null }>()
    inventoryLots.forEach(lot => {
      inventoryMap.set(lot.order_detail_id, {
        pallet_count: lot.pallet_count,
        unbooked_pallet_count: lot.unbooked_pallet_count,
      })
    })

    // 序列化并格式化数据
    const serializedLines = appointmentDetailLines.map(line => {
      const serialized = serializeBigInt(line)
      const orderDetail = serializeBigInt(line.order_detail)
      const orderDetailOrders = line.order_detail.orders ? serializeBigInt(line.order_detail.orders) : null
      const deliveryLocationId = orderDetail.delivery_location
      const locationCode = deliveryLocationId && locationsMap.has(deliveryLocationId)
        ? locationsMap.get(deliveryLocationId) || null
        : null

      // 检查是否已入库
      const inventoryLot = inventoryMap.get(line.order_detail_id)
      const hasInventory = inventoryLot && inventoryLot.pallet_count > 0
      
      // 确定总板数：已入库使用 unbooked_pallet_count，未入库使用 remaining_pallets
      const totalPallets = hasInventory 
        ? (inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count)
        : (orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0)

      // 调试日志
      if (hasInventory) {
        console.log(`[appointment-detail-lines] 已入库仓点 order_detail_id=${line.order_detail_id}: pallet_count=${inventoryLot.pallet_count}, unbooked_pallet_count=${inventoryLot.unbooked_pallet_count}, totalPallets=${totalPallets}`)
      } else {
        console.log(`[appointment-detail-lines] 未入库仓点 order_detail_id=${line.order_detail_id}: remaining_pallets=${orderDetail.remaining_pallets}, estimated_pallets=${orderDetail.estimated_pallets}, totalPallets=${totalPallets}`)
      }

      return {
        id: serialized.id,
        appointment_id: serialized.appointment_id,
        order_detail_id: serialized.order_detail_id,
        estimated_pallets: serialized.estimated_pallets, // 这个预约送了多少板
        total_pallets_at_time: serialized.total_pallets_at_time, // 总板数快照（历史值，仅用于审计）
        // PO 从 order_detail 读取（不再使用 appointment_detail_lines.po）
        po: orderDetail.po || null,
        // 从 order_detail 获取的数据
        order_id: orderDetail.order_id,
        quantity: orderDetail.quantity,
        volume: orderDetail.volume,
        estimated_pallets_total: orderDetail.estimated_pallets, // 预计板数（用于显示，但不直接使用）
        remaining_pallets: totalPallets, // 总板数（已入库用 unbooked_pallet_count，未入库用 remaining_pallets）- 这是实时值，用于显示和验证
        has_inventory: hasInventory, // 是否有库存
        inventory_pallets: hasInventory ? inventoryLot.pallet_count : null, // 库存板数
        delivery_nature: orderDetail.delivery_nature,
        delivery_location: locationCode || orderDetail.delivery_location,
        delivery_location_code: locationCode,
        unload_type: orderDetail.unload_type,
        volume_percentage: orderDetail.volume_percentage,
        notes: orderDetail.notes,
        // 从 delivery_appointments 获取的数据
        reference_number: line.delivery_appointments.reference_number,
        // 从 order_detail.orders 获取柜号（order_number）
        order_number: orderDetailOrders?.order_number || null,
        // SKU 明细
        order_detail_item_order_detail_item_detail_idToorder_detail: orderDetail.order_detail_item_order_detail_item_detail_idToorder_detail,
      }
    })

    return NextResponse.json({
      success: true,
      data: serializedLines,
    })
  } catch (error: any) {
    console.error('获取预约明细失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '获取预约明细失败' 
      },
      { status: 500 }
    )
  }
}

// POST - 创建预约明细
export async function POST(request: NextRequest) {
  let body: any = null
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    body = await request.json()
    const { appointment_id, order_detail_id, estimated_pallets } = body

    if (!appointment_id || !order_detail_id || estimated_pallets === undefined) {
      return NextResponse.json({ error: '缺少必需字段：appointment_id, order_detail_id, estimated_pallets' }, { status: 400 })
    }
    
    // PO 不再从请求中获取，应该从 order_detail.po 读取

    // 检查是否已存在（使用 findFirst 因为复合唯一约束）
    const existing = await prisma.appointment_detail_lines.findFirst({
      where: {
        appointment_id: BigInt(appointment_id),
        order_detail_id: BigInt(order_detail_id),
      },
    })

    if (existing) {
      return NextResponse.json({ error: '该预约明细已存在' }, { status: 400 })
    }

    const orderDetailId = BigInt(order_detail_id)
    const appointmentId = BigInt(appointment_id)
    const estimatedPalletsValue = parseInt(estimated_pallets) || 0

    // 检查是否已入库（查询 inventory_lots）
    const inventoryLot = await prisma.inventory_lots.findFirst({
      where: {
        order_detail_id: orderDetailId,
      },
      select: {
        inventory_lot_id: true,
        unbooked_pallet_count: true,
        pallet_count: true,
      },
    })

    // 确定总板数（用于保存快照）
    let totalPalletsAtTime: number
    if (inventoryLot && inventoryLot.pallet_count > 0) {
      // 已入库：使用未约板数
      totalPalletsAtTime = inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count ?? 0
    } else {
      // 未入库：使用 order_detail 的剩余板数
      const orderDetail = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { remaining_pallets: true, estimated_pallets: true },
      })
      totalPalletsAtTime = orderDetail?.remaining_pallets ?? orderDetail?.estimated_pallets ?? 0
    }

    // 验证预计板数不能超过总板数
    if (estimatedPalletsValue > totalPalletsAtTime) {
      return NextResponse.json({ 
        error: `预计板数（${estimatedPalletsValue}）不能超过总板数（${totalPalletsAtTime}）` 
      }, { status: 400 })
    }

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 创建预约明细（PO 不再存储，从 order_detail.po 读取）
      const appointmentDetailLine = await tx.appointment_detail_lines.create({
        data: {
          appointment_id: appointmentId,
          order_detail_id: orderDetailId,
          estimated_pallets: estimatedPalletsValue,
          total_pallets_at_time: totalPalletsAtTime, // 保存总板数快照
          // po 字段已移除，PO 从 order_detail.po 读取
          created_by: session.user.id ? BigInt(session.user.id) : null,
          updated_by: session.user.id ? BigInt(session.user.id) : null,
        },
      })

      // 更新相关板数字段
      if (inventoryLot && inventoryLot.pallet_count > 0) {
        // 已入库：更新 inventory_lots.unbooked_pallet_count
        const newUnbookedCount = (inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count) - estimatedPalletsValue
        await tx.inventory_lots.update({
          where: { inventory_lot_id: inventoryLot.inventory_lot_id },
          data: { unbooked_pallet_count: newUnbookedCount },
        })
      } else {
        // 未入库：更新 order_detail.remaining_pallets
        const orderDetail = await tx.order_detail.findUnique({
          where: { id: orderDetailId },
          select: { remaining_pallets: true, estimated_pallets: true },
        })
        if (orderDetail) {
          const currentRemaining = orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0
          const newRemaining = Math.max(0, currentRemaining - estimatedPalletsValue)
          await tx.order_detail.update({
            where: { id: orderDetailId },
            data: { remaining_pallets: newRemaining },
          })
        }
      }

      // 更新 delivery_appointments.total_pallets（累加）
      const appointment = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { total_pallets: true },
      })
      if (appointment) {
        await tx.delivery_appointments.update({
          where: { appointment_id: appointmentId },
          data: { total_pallets: (appointment.total_pallets || 0) + estimatedPalletsValue },
        })
      }

      return appointmentDetailLine
    })

    return NextResponse.json(
      { 
        success: true,
        data: serializeBigInt(result) 
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('创建预约明细失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
      body: body,
    })
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '创建预约明细失败' 
      },
      { status: 500 }
    )
  }
}
