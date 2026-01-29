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
            // delivery_location_id 通过关系获取，不需要在 select 中
            locations_order_detail_delivery_location_idTolocations: {
              select: {
                location_id: true,
                location_code: true,
                name: true,
              },
            } as any, // TypeScript workaround for Prisma relation type inference
            fba: true,
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
          } as any, // TypeScript workaround for Prisma type inference
        },
        delivery_appointments: {
          select: {
            reference_number: true,
          },
        },
      },
    }) as any[] // Type assertion to help TypeScript understand the include types

    // delivery_location_id 现在有外键约束，关联数据通过 Prisma include 自动加载
    // 不需要手动查询 locations 了

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

    // 序列化并格式化数据（跳过关联缺失的行，避免单条异常导致整表不显示）
    const serializedLines: any[] = []
    for (const line of appointmentDetailLines) {
      const orderDetail = line.order_detail ? serializeBigInt(line.order_detail) : null
      const deliveryAppointment = line.delivery_appointments
      if (!orderDetail || !deliveryAppointment) {
        console.warn(`[appointment-detail-lines] 跳过明细 id=${line.id}: order_detail=${!!orderDetail}, delivery_appointments=${!!deliveryAppointment}`)
        continue
      }
      const serialized = serializeBigInt(line)
      const orderDetailOrders = orderDetail.orders ? serializeBigInt(orderDetail.orders) : null
      const locationCode = orderDetail.locations_order_detail_delivery_location_idTolocations?.location_code || null

      const inventoryLot = inventoryMap.get(line.order_detail_id)
      const hasInventory = inventoryLot && inventoryLot.pallet_count > 0
      const totalPallets = hasInventory
        ? (inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count)
        : (orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0)

      if (hasInventory) {
        console.log(`[appointment-detail-lines] 已入库仓点 order_detail_id=${line.order_detail_id}: pallet_count=${inventoryLot.pallet_count}, unbooked_pallet_count=${inventoryLot.unbooked_pallet_count}, totalPallets=${totalPallets}`)
      } else {
        console.log(`[appointment-detail-lines] 未入库仓点 order_detail_id=${line.order_detail_id}: remaining_pallets=${orderDetail.remaining_pallets}, estimated_pallets=${orderDetail.estimated_pallets}, totalPallets=${totalPallets}`)
      }

      serializedLines.push({
        id: serialized.id,
        appointment_id: serialized.appointment_id,
        order_detail_id: serialized.order_detail_id,
        estimated_pallets: serialized.estimated_pallets,
        rejected_pallets: (serialized as any).rejected_pallets ?? 0, // 兼容 DB 尚未加列时
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
        delivery_location: locationCode,
        delivery_location_code: locationCode,
        fba: orderDetail.fba,
        volume_percentage: orderDetail.volume_percentage,
        notes: orderDetail.notes,
        // 从 delivery_appointments 获取的数据
        reference_number: deliveryAppointment.reference_number,
        // 从 order_detail.orders 获取柜号（order_number）
        order_number: orderDetailOrders?.order_number || null,
        // SKU 明细
        order_detail_item_order_detail_item_detail_idToorder_detail: orderDetail.order_detail_item_order_detail_item_detail_idToorder_detail,
      })
    }

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

    // 实时计算总板数（用于验证和保存快照）：未约板数 = 预计/实际板数 - 有效占用（有效占用 = estimated_pallets - rejected_pallets）
    const effectiveBooked = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
    let totalPalletsAtTime: number
    const existingAppointmentLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { estimated_pallets: true, rejected_pallets: true } as { estimated_pallets: true; rejected_pallets: true },
    })
    const totalEffectiveBooked = existingAppointmentLines.reduce((sum, line) => sum + effectiveBooked(line.estimated_pallets, (line as { rejected_pallets?: number | null }).rejected_pallets), 0)
    if (inventoryLot && inventoryLot.pallet_count > 0) {
      totalPalletsAtTime = inventoryLot.pallet_count - totalEffectiveBooked
    } else {
      const orderDetail = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { estimated_pallets: true },
      })
      const estimatedPallets = orderDetail?.estimated_pallets ?? 0
      totalPalletsAtTime = estimatedPallets - totalEffectiveBooked
    }

    // 验证预计板数不能超过总板数
    if (estimatedPalletsValue > totalPalletsAtTime) {
      return NextResponse.json({ 
        error: `预计板数（${estimatedPalletsValue}）不能超过总板数（${totalPalletsAtTime}）` 
      }, { status: 400 })
    }

    const { recalcUnbookedRemainingForOrderDetail } = await import('@/lib/services/recalc-unbooked-remaining.service')

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 创建预约明细（rejected_pallets 新建默认为 0）
      const appointmentDetailLine = await tx.appointment_detail_lines.create({
        data: {
          appointment_id: appointmentId,
          order_detail_id: orderDetailId,
          estimated_pallets: estimatedPalletsValue,
          rejected_pallets: 0,
          total_pallets_at_time: totalPalletsAtTime,
          created_by: session.user.id ? BigInt(session.user.id) : null,
          updated_by: session.user.id ? BigInt(session.user.id) : null,
        } as import('@prisma/client').Prisma.appointment_detail_linesUncheckedCreateInput,
      })

      // 重算并写回未约板数/剩余板数（含拒收板数公式）
      await recalcUnbookedRemainingForOrderDetail(orderDetailId, tx)

      // 更新 delivery_appointments.total_pallets（累加预计板数，用于展示）
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

    // 同步订单的预约信息
    try {
      const orderDetail = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { order_id: true },
      })
      if (orderDetail?.order_id) {
        const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
        await syncOrderAppointmentInfo(orderDetail.order_id)
      }
    } catch (syncError: any) {
      console.warn('同步订单预约信息失败:', syncError)
      // 不影响预约明细创建，只记录警告
    }

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
