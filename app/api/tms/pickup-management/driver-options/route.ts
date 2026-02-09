/**
 * GET /api/tms/pickup-management/driver-options
 * 返回提柜管理中司机字段的所有去重值，供筛选下拉使用
 */

import { NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const rows = await prisma.pickup_management.findMany({
      where: { driver_name: { not: null } },
      select: { driver_name: true },
      distinct: ['driver_name'],
      orderBy: { driver_name: 'asc' },
    })
    const options = rows
      .map((r) => r.driver_name)
      .filter((name): name is string => name != null && name.trim() !== '')
      .map((name) => ({ value: name, label: name }))
    return NextResponse.json({ data: options })
  } catch (error: any) {
    console.error('[提柜管理司机选项] 错误:', error)
    return NextResponse.json(
      { error: '获取司机选项失败', message: error.message },
      { status: 500 }
    )
  }
}
