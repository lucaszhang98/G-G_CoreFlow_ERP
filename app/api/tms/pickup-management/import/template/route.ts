/**
 * 提柜管理批量导入模板 - 获取模板参考数据 API
 * 返回码头/查验站（port 类型位置）、承运公司、司机，供模板下拉框使用
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const [locations, carriers, drivers] = await Promise.all([
      prisma.locations.findMany({
        where: { location_type: 'port' },
        select: { location_id: true, location_code: true, name: true },
        orderBy: { location_code: 'asc' },
      }),
      prisma.carriers.findMany({
        select: { carrier_id: true, name: true, carrier_code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.drivers.findMany({
        select: { driver_id: true, driver_code: true },
        orderBy: { driver_code: 'asc' },
      }),
    ])

    return NextResponse.json({
      locations: locations.map((l) => ({
        location_code: l.location_code,
        name: l.name,
      })),
      carriers: carriers.map((c) => ({
        name: c.name,
        carrier_code: c.carrier_code,
      })),
      drivers: drivers.map((d) => ({
        driver_code: d.driver_code,
      })),
    })
  } catch (error: any) {
    console.error('[提柜管理模板数据] 错误:', error)
    return NextResponse.json(
      { error: '获取参考数据失败', message: error.message },
      { status: 500 }
    )
  }
}
