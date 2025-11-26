/**
 * 获取码头和查验站列表 API
 * 用于海柜管理中的码头/查验站选择
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/**
 * GET /api/locations/ports
 * 获取所有码头和查验站
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 查询 location_type 为 'port' 或 'inspection' 的位置
    const locations = await prisma.locations.findMany({
      where: {
        location_type: {
          in: ['port', 'inspection'],
        },
      },
      select: {
        location_id: true,
        name: true,
        location_code: true,
        location_type: true,
        city: true,
        country: true,
      },
      orderBy: [
        { location_type: 'asc' }, // 先显示码头，再显示查验站
        { name: 'asc' },
      ],
    })

    // 序列化 BigInt
    const serialized = locations.map((loc) => ({
      ...loc,
      location_id: String(loc.location_id),
    }))

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('获取码头/查验站列表失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取码头/查验站列表失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

