/**
 * 初始化提柜管理记录
 * 为所有没有对应提柜管理记录的订单创建提柜管理记录
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// POST - 初始化提柜管理记录
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 检查权限：只有 admin 和 tms_manager 可以初始化
    const user = authResult.user
    if (!user || (!user.role?.includes('admin') && !user.role?.includes('tms_manager'))) {
      return NextResponse.json(
        { error: '权限不足，只有管理员和TMS管理员可以初始化提柜管理记录' },
        { status: 403 }
      )
    }

    // 查找所有没有对应提柜管理记录的订单
    const ordersWithoutPickup = await prisma.orders.findMany({
      where: {
        pickup_management: null, // 没有对应的提柜管理记录
      },
      select: {
        order_id: true,
      },
    })

    if (ordersWithoutPickup.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有订单都已有关联的提柜管理记录',
        created: 0,
        total: 0,
      })
    }

    // 批量创建提柜管理记录
    const createdRecords = []
    const errors = []

    for (const order of ordersWithoutPickup) {
      try {
        const pickupData: any = {
          order_id: order.order_id,
          status: 'planned', // 默认状态：计划中
        }

        // 添加系统字段
        await addSystemFields(pickupData, user, true)

        const created = await prisma.pickup_management.create({
          data: pickupData,
        })

        createdRecords.push({
          pickup_id: String(created.pickup_id),
          order_id: String(order.order_id),
        })
      } catch (error: any) {
        errors.push({
          order_id: String(order.order_id),
          error: error.message || '创建失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功为 ${createdRecords.length} 个订单创建了提柜管理记录`,
      created: createdRecords.length,
      total: ordersWithoutPickup.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('初始化提柜管理记录失败:', error)
    return NextResponse.json(
      {
        error: error.message || '初始化提柜管理记录失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
