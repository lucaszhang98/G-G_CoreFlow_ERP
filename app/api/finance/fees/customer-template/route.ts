/**
 * GET /api/finance/fees/customer-template?customerId=...
 * 按客户生成费用批量导入 Excel 数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import { buildCustomerFeeImportRows } from '@/lib/finance/customer-fee-import-template'

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const user = authResult.user
    if (!user || !['admin', 'oms_manager'].includes(user.role || '')) {
      return NextResponse.json(
        { error: '权限不足，仅管理员或 OMS 经理可下载费用导入模板' },
        { status: 403 }
      )
    }

    const customerIdParam = request.nextUrl.searchParams.get('customerId')
    if (!customerIdParam) {
      return NextResponse.json({ error: '请先选择客户' }, { status: 400 })
    }

    let customerId: bigint
    try {
      customerId = BigInt(customerIdParam)
    } catch {
      return NextResponse.json({ error: '无效的客户 ID' }, { status: 400 })
    }

    const { customer, rows } = await buildCustomerFeeImportRows(customerId)

    return NextResponse.json(
      serializeBigInt({
        customer: {
          id: customer.id,
          code: customer.code,
          name: customer.name,
        },
        rows,
      })
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '生成模板数据失败'
    console.error('[fees/customer-template]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
