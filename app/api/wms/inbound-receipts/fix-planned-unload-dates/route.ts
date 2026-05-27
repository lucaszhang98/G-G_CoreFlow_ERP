/**
 * 批量修复入库管理拆柜日期 API
 *
 * 1) 现在位置含「查验」或「封闭区」但 planned_unload_at 仍有值 → 置空
 * 2) planned_unload_at 为空且未录入拆柜人员 → 按提柜/ETA 回填（不含上述关键词的订单）
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'
import { runFixPlannedUnloadDates } from '@/lib/wms/run-fix-planned-unload-dates'

/**
 * POST /api/wms/inbound-receipts/fix-planned-unload-dates
 */
export async function POST(_request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const result = await runFixPlannedUnloadDates()
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('批量修复拆柜日期失败:', error)
    const message = error instanceof Error ? error.message : '批量修复拆柜日期失败'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
