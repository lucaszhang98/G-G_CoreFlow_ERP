/**
 * 手动同步订单预约信息 API
 * 
 * 功能：
 * 1. 批量同步所有订单的预约信息
 * 2. 或同步指定订单的预约信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncOrderAppointmentInfo, syncMultipleOrdersAppointmentInfo } from '@/lib/services/sync-order-appointment-info'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { order_ids } = body // 可选的订单ID数组，如果不提供则同步所有订单

    if (order_ids && Array.isArray(order_ids) && order_ids.length > 0) {
      // 同步指定订单
      const orderIdsBigInt = order_ids.map((id: string | number) => BigInt(id))
      await syncMultipleOrdersAppointmentInfo(orderIdsBigInt)
      
      return NextResponse.json({
        success: true,
        message: `成功同步 ${order_ids.length} 个订单的预约信息`,
        synced_count: order_ids.length,
      })
    } else {
      // 同步所有订单
      const allOrders = await prisma.orders.findMany({
        select: {
          order_id: true,
        },
      })

      const orderIds = allOrders.map(o => o.order_id)
      await syncMultipleOrdersAppointmentInfo(orderIds)

      return NextResponse.json({
        success: true,
        message: `成功同步 ${orderIds.length} 个订单的预约信息`,
        synced_count: orderIds.length,
      })
    }
  } catch (error: any) {
    console.error('同步订单预约信息失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '同步订单预约信息失败',
      },
      { status: 500 }
    )
  }
}

