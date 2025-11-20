import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// GET - 获取容器列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const search = searchParams.get('search') || ''
    const sourceType = searchParams.get('source_type') || ''
    const status = searchParams.get('status') || ''

    // 构建查询条件
    const where: any = {}

    // 搜索条件（搜索容器ID、订单号）
    if (search) {
      where.OR = [
        {
          orders: {
            order_number: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        },
      ]
    }

    // 容器类型筛选
    if (sourceType) {
      where.source_type = sourceType
    }

    // 状态筛选
    if (status) {
      where.status = status
    }

    // 查询总数
    const total = await prisma.containers.count({ where })

    // 查询数据
    const containers = await prisma.containers.findMany({
      where,
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            status: true,
            customers: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        trailers: {
          select: {
            trailer_id: true,
            trailer_code: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 序列化数据并确保所有 ID 字段都是字符串
    // serializeBigInt 现在会自动处理 Date 对象，转换为 ISO 字符串
    const serializedContainers = containers.map((container: any) => {
      const serialized = serializeBigInt(container)
      return {
        ...serialized,
        container_id: String(serialized.container_id || ''),
        order_id: serialized.order_id ? String(serialized.order_id) : null,
        trailer_id: serialized.trailer_id ? String(serialized.trailer_id) : null,
        orders: serialized.orders ? {
          ...serialized.orders,
          order_id: String(serialized.orders.order_id || ''),
          customers: serialized.orders.customers ? {
            ...serialized.orders.customers,
            id: String(serialized.orders.customers.id || ''),
          } : null,
        } : null,
        trailers: serialized.trailers ? {
          ...serialized.trailers,
          trailer_id: String(serialized.trailers.trailer_id || ''),
        } : null,
      }
    })

    return NextResponse.json({
      data: serializedContainers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('获取容器列表失败:', error)
    return NextResponse.json(
      { error: error.message || '获取容器列表失败' },
      { status: 500 }
    )
  }
}

