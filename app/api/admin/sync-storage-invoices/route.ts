/**
 * 管理员工具：按当前规则为所有「已入库 + 含扣货明细」的订单重算仓储账单。
 * 用于历史数据补全或上线后一次性同步。
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { backfillAllStorageInvoicesForReceivedDetentionOrders } from '@/lib/finance/storage-invoice-sync'

export async function POST(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以执行此操作' }, { status: 403 })
    }

    const userId = session.user.id ? BigInt(session.user.id) : null
    const result = await backfillAllStorageInvoicesForReceivedDetentionOrders(userId)

    return NextResponse.json({
      success: true,
      message: `已处理 ${result.orderCount} 个订单：成功 ${result.ok}，失败 ${result.failed}`,
      data: result,
    })
  } catch (error: any) {
    console.error('[Sync Storage Invoices] 执行失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '同步失败' },
      { status: 500 }
    )
  }
}
