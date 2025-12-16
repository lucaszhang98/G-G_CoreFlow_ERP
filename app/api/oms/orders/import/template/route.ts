import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

/**
 * GET - 获取模板生成所需的参考数据
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取客户列表和位置列表
    const [customers, locations] = await Promise.all([
      prisma.customers.findMany({
        select: {
          code: true,
          name: true
        },
        orderBy: { code: 'asc' }
      }),
      prisma.locations.findMany({
        select: {
          location_code: true,
          name: true
        },
        orderBy: { location_code: 'asc' }
      })
    ])

    return NextResponse.json({
      customers,
      locations
    })

  } catch (error: any) {
    console.error('获取模板数据失败:', error)
    return NextResponse.json(
      { error: error.message || '获取模板数据失败' },
      { status: 500 }
    )
  }
}

