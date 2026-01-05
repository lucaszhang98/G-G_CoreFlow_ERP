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
    if (updates.container_type !== undefined) {
      orderUpdateData.container_type = updates.container_type || null
    }
    // 日期字段 - 使用UTC处理避免时区转换
    if (updates.lfd_date !== undefined) {
      if (updates.lfd_date && typeof updates.lfd_date === 'string') {
        // YYYY-MM-DD 格式，转换为 UTC Date
        const [year, month, day] = updates.lfd_date.split('-').map(Number)
        if (year && month && day) {
          orderUpdateData.lfd_date = new Date(Date.UTC(year, month - 1, day))
        } else {
          orderUpdateData.lfd_date = null
        }
      } else {
        orderUpdateData.lfd_date = null
      }
    }
    if (updates.pickup_date !== undefined) {
      if (updates.pickup_date && typeof updates.pickup_date === 'string') {
        // YYYY-MM-DDTHH:mm 格式，解析为 UTC 时间戳
        const match = updates.pickup_date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
        if (match) {
          const [, year, month, day, hours, minutes] = match
          orderUpdateData.pickup_date = new Date(Date.UTC(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hours, 10),
            parseInt(minutes, 10)
          ))
        } else {
          orderUpdateData.pickup_date = null
        }
      } else {
        orderUpdateData.pickup_date = null
      }
    }
    if (updates.ready_date !== undefined) {
      if (updates.ready_date && typeof updates.ready_date === 'string') {
        const [year, month, day] = updates.ready_date.split('-').map(Number)
        if (year && month && day) {
          orderUpdateData.ready_date = new Date(Date.UTC(year, month - 1, day))
        } else {
          orderUpdateData.ready_date = null
        }
      } else {
        orderUpdateData.ready_date = null
      }
    }
    if (updates.return_deadline !== undefined) {
      if (updates.return_deadline && typeof updates.return_deadline === 'string') {
        const [year, month, day] = updates.return_deadline.split('-').map(Number)
        if (year && month && day) {
          orderUpdateData.return_deadline = new Date(Date.UTC(year, month - 1, day))
        } else {
          orderUpdateData.return_deadline = null
        }
      } else {
        orderUpdateData.return_deadline = null
      }
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

