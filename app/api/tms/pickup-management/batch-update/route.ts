import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// POST - 批量更新提柜管理记录
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { ids, updates } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '请提供要更新的记录ID列表' },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: '请提供要更新的字段' },
        { status: 400 }
      )
    }

    const user = authResult.user || null

    // 分离提柜管理自有字段和订单字段
    const pickupUpdateData: any = {}
    const orderUpdateData: any = {}

    // 提柜管理自有字段
    if (updates.status !== undefined) {
      pickupUpdateData.status = updates.status
    }
    if (updates.current_location !== undefined) {
      pickupUpdateData.current_location = updates.current_location || null
    }
    if (updates.notes !== undefined) {
      pickupUpdateData.notes = updates.notes
    }

    // 订单字段（通过提柜管理修改）
    if (updates.port_location_id !== undefined) {
      orderUpdateData.port_location_id = updates.port_location_id 
        ? BigInt(updates.port_location_id) 
        : null
    }
    if (updates.carrier_id !== undefined) {
      orderUpdateData.carrier_id = updates.carrier_id 
        ? BigInt(updates.carrier_id) 
        : null
    }
    // 日期字段
    if (updates.lfd_date !== undefined) {
      orderUpdateData.lfd_date = updates.lfd_date 
        ? new Date(updates.lfd_date) 
        : null
    }
    if (updates.pickup_date !== undefined) {
      orderUpdateData.pickup_date = updates.pickup_date 
        ? new Date(updates.pickup_date) 
        : null
    }
    if (updates.ready_date !== undefined) {
      orderUpdateData.ready_date = updates.ready_date 
        ? new Date(updates.ready_date) 
        : null
    }
    if (updates.return_deadline !== undefined) {
      orderUpdateData.return_deadline = updates.return_deadline 
        ? new Date(updates.return_deadline) 
        : null
    }

    // 转换为 BigInt
    const bigIntIds = ids.map((id: string | number) => BigInt(id))

    // 获取所有 pickup_management 记录，以获取关联的 order_id
    const pickups = await prisma.pickup_management.findMany({
      where: { pickup_id: { in: bigIntIds } },
      select: { pickup_id: true, order_id: true },
    })

    if (pickups.length === 0) {
      return NextResponse.json(
        { error: '未找到要更新的记录' },
        { status: 404 }
      )
    }

    const orderIds = pickups.map((p: any) => p.order_id)

    // 应用系统字段
    if (Object.keys(pickupUpdateData).length > 0) {
      await addSystemFields(pickupUpdateData, user, false)
      await prisma.pickup_management.updateMany({
        where: { pickup_id: { in: bigIntIds } },
        data: pickupUpdateData,
      })
    }

    // 更新 orders 表（如果有关联字段需要更新）
    if (Object.keys(orderUpdateData).length > 0) {
      await addSystemFields(orderUpdateData, user, false)
      await prisma.orders.updateMany({
        where: { order_id: { in: orderIds } },
        data: orderUpdateData,
      })
    }

    return NextResponse.json({
      success: true,
      message: `成功更新 ${pickups.length} 条记录`,
      updated: pickups.length,
    })
  } catch (error: any) {
    console.error('批量更新提柜管理记录失败:', error)
    return NextResponse.json(
      { error: error.message || '批量更新提柜管理记录失败' },
      { status: 500 }
    )
  }
}

