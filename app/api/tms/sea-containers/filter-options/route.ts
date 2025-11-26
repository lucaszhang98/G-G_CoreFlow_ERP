/**
 * 获取海柜管理筛选选项 API
 * 用于动态加载筛选下拉框的选项
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/**
 * GET /api/tms/sea-containers/filter-options
 * 获取筛选选项
 * 支持查询参数 type: 'port_location' | 'carrier' | 'operation_mode'
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    if (type === 'port_location') {
      // 获取码头/查验站列表
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
        },
        orderBy: [
          { location_type: 'asc' },
          { name: 'asc' },
        ],
      })

      const options = locations.map((loc) => ({
        label: `${loc.name}${loc.location_code ? ` (${loc.location_code})` : ''}${loc.location_type === 'port' ? ' [码头]' : ' [查验站]'}`,
        value: loc.name, // 使用名称作为值，因为目前 port_location 是文本字段
      }))

      return NextResponse.json(options)
    }

    if (type === 'carrier') {
      // 获取承运公司列表
      const carriers = await prisma.carriers.findMany({
        select: {
          carrier_id: true,
          name: true,
          carrier_code: true,
        },
        orderBy: {
          name: 'asc',
        },
      })

      const options = carriers.map((carrier) => ({
        label: carrier.name || carrier.carrier_code || `承运商 ${carrier.carrier_id}`,
        value: String(carrier.carrier_id), // 使用 carrier_id 作为值
      }))

      return NextResponse.json(options)
    }

    if (type === 'operation_mode') {
      // 获取操作方式的唯一值列表
      const distinctModes = await prisma.$queryRaw<Array<{ operation_mode: string | null }>>`
        SELECT DISTINCT operation_mode
        FROM public.orders
        WHERE operation_mode IS NOT NULL
        AND operation_mode != ''
        ORDER BY operation_mode ASC
      `

      const options = distinctModes
        .filter((row) => row.operation_mode)
        .map((row) => ({
          label: row.operation_mode!,
          value: row.operation_mode!,
        }))

      return NextResponse.json(options)
    }

    return NextResponse.json(
      { error: '无效的 type 参数，必须是 port_location, carrier, 或 operation_mode' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('获取筛选选项失败:', error)
    return NextResponse.json(
      {
        error: error.message || '获取筛选选项失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

