/**
 * 下载预约批量导入模板 API
 */

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

    // 获取位置列表（用于下拉框）
    const locations = await prisma.locations.findMany({
      select: {
        location_code: true,
        name: true
      },
      orderBy: { location_code: 'asc' }
    })

    return NextResponse.json({
      locations
    })

  } catch (error: any) {
    console.error('[模板数据] 错误:', error)
    return NextResponse.json(
      { error: '获取参考数据失败', message: error.message },
      { status: 500 }
    )
  }
}






