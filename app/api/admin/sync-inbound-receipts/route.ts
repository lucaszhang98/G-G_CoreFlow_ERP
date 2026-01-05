/**
 * 管理员工具：同步入库管理记录
 * 
 * 用于补齐历史数据中缺失的 inbound_receipt 记录
 * 只有管理员可以执行此操作
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inboundSyncService } from '@/lib/services/inbound-sync.service'

export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: '只有管理员可以执行此操作' }, { status: 403 })
    }

    // 2. 执行同步
    const userId = session.user.id ? BigInt(session.user.id) : undefined
    const result = await inboundSyncService.syncAllMissingInboundReceipts(userId)

    // 3. 返回结果
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `成功同步 ${result.created} 条入库管理记录`,
        data: {
          total: result.total,
          created: result.created,
          errors: result.errors,
        },
      })
    } else {
      return NextResponse.json({
        success: false,
        message: '同步失败',
        data: {
          total: result.total,
          created: result.created,
          errors: result.errors,
          errorMessages: result.errorMessages,
        },
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Sync Inbound Receipts] 执行失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '同步失败',
    }, { status: 500 })
  }
}

