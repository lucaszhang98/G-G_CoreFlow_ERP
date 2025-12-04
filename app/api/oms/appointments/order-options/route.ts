import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

// GET - 获取订单列表（用于选择柜号）
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // 构建查询条件
    const where: any = {
      status: { not: 'archived' }, // 排除已归档的订单
    }

    // 模糊搜索订单号
    if (search) {
      where.order_number = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // 查询订单列表，只返回订单ID和订单号
    const orders = await prisma.orders.findMany({
      where,
      select: {
        order_id: true,
        order_number: true,
      },
      orderBy: {
        order_number: 'asc',
      },
      take: 50, // 限制返回数量
    })

    return NextResponse.json({
      success: true,
      data: orders.map(order => ({
        order_id: order.order_id.toString(),
        order_number: order.order_number,
      })),
    })
  } catch (error: any) {
    console.error('获取订单列表失败:', error)
    return NextResponse.json(
      { error: '获取订单列表失败', message: error.message },
      { status: 500 }
    )
  }
}

