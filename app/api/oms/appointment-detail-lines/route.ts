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

    // 序列化并格式化数据
    const serializedLines = appointmentDetailLines.map(line => {
      const serialized = serializeBigInt(line)
      const orderDetail = serializeBigInt(line.order_detail)
      const orderDetailOrders = line.order_detail.orders ? serializeBigInt(line.order_detail.orders) : null
      const deliveryLocationId = orderDetail.delivery_location
      const locationCode = deliveryLocationId && locationsMap.has(deliveryLocationId)
        ? locationsMap.get(deliveryLocationId) || null
        : null

      return {
        id: serialized.id,
        appointment_id: serialized.appointment_id,
        order_detail_id: serialized.order_detail_id,
        estimated_pallets: serialized.estimated_pallets, // 这个预约送了多少板
        // PO 优先使用 appointment_detail_lines 的，如果没有则使用 order_detail 的
        po: serialized.po || orderDetail.po || null,
        // 从 order_detail 获取的数据
        order_id: orderDetail.order_id,
        quantity: orderDetail.quantity,
        volume: orderDetail.volume,
        estimated_pallets_total: orderDetail.estimated_pallets, // 总板数（用于显示，但不直接使用）
        remaining_pallets: orderDetail.remaining_pallets, // 剩余板数（用于显示总板数）
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
    const { appointment_id, order_detail_id, estimated_pallets, po } = body

    if (!appointment_id || !order_detail_id || estimated_pallets === undefined) {
      return NextResponse.json({ error: '缺少必需字段：appointment_id, order_detail_id, estimated_pallets' }, { status: 400 })
    }

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

    // 创建预约明细
    const appointmentDetailLine = await prisma.appointment_detail_lines.create({
      data: {
        appointment_id: BigInt(appointment_id),
        order_detail_id: BigInt(order_detail_id),
        estimated_pallets: parseInt(estimated_pallets) || 0,
        po: po || null,
        created_by: session.user.id ? BigInt(session.user.id) : null,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
      },
    })

    // 重新计算并更新 order_detail.remaining_pallets
    await updateRemainingPallets(BigInt(order_detail_id))

    return NextResponse.json(
      { 
        success: true,
        data: serializeBigInt(appointmentDetailLine) 
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

// 辅助函数：更新 order_detail 的剩余板数
async function updateRemainingPallets(orderDetailId: bigint) {
  try {
    // 获取 order_detail 的总板数
    const orderDetail = await prisma.order_detail.findUnique({
      where: { id: orderDetailId },
      select: { estimated_pallets: true },
    })

    if (!orderDetail || !orderDetail.estimated_pallets) {
      return
    }

    const totalPallets = orderDetail.estimated_pallets

    // 计算所有预约的预计板数之和
    const appointmentLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { estimated_pallets: true },
    })

    const totalAppointmentPallets = appointmentLines.reduce((sum, line) => {
      return sum + (line.estimated_pallets || 0)
    }, 0)

    // 计算剩余板数
    const remainingPallets = Math.max(0, totalPallets - totalAppointmentPallets)

    // 更新 order_detail.remaining_pallets
    await prisma.order_detail.update({
      where: { id: orderDetailId },
      data: { remaining_pallets: remainingPallets },
    })
  } catch (error) {
    console.error('更新剩余板数失败:', error)
    throw error
  }
}

