/**
 * GET /api/finance/fees/by-customer/[customerId]
 * 返回适用于该客户的费用列表（scope_type=all 或 scope_type=customers 且 fee_scope 包含该客户）
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { parsePaginationParams, buildPaginationResponse, serializeBigInt } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const permissionResult = await checkPermission(feeConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { customerId } = await context.params
    if (!customerId) {
      return NextResponse.json({ error: '缺少客户 ID' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const { page, limit, sort, order } = parsePaginationParams(
      searchParams,
      feeConfig.list.defaultSort || 'fee_code',
      feeConfig.list.defaultOrder || 'asc',
      100
    )

    const where = {
      OR: [
        { scope_type: 'all' },
        {
          scope_type: 'customers',
          fee_scope: {
            some: { customer_id: BigInt(customerId) },
          },
        },
      ],
    }

    const [items, total] = await Promise.all([
      prisma.fee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.fee.count({ where }),
    ])

    const data = items.map((item) => serializeBigInt(item))
    return NextResponse.json(buildPaginationResponse(data, total, page, limit))
  } catch (error: any) {
    console.error('[fees/by-customer]', error)
    return NextResponse.json(
      { error: error?.message || '获取客户费用列表失败' },
      { status: 500 }
    )
  }
}
