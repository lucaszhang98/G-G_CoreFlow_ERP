/**
 * GET /api/finance/summary/receivables-matrix
 * 财务汇总：按客户 × 发票开票月份汇总仍有余额的应收（与应收列表同权限）
 */

import { NextResponse } from 'next/server'
import { checkPermission, handleError } from '@/lib/api/helpers'
import { receivableConfig } from '@/lib/crud/configs/receivables'
import { buildReceivablesSummaryMatrix } from '@/lib/finance/receivables-summary-matrix'

export async function GET() {
  try {
    const permissionResult = await checkPermission(receivableConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const data = await buildReceivablesSummaryMatrix()
    return NextResponse.json({ data })
  } catch (e) {
    return handleError(e, '加载财务汇总失败')
  }
}
