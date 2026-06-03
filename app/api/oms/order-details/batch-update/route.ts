/**
 * POST /api/oms/order-details/batch-update
 * 批量更新订单明细（仅允许与单行编辑一致的字段）
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, handleError } from '@/lib/api/helpers'
import { orderDetailConfig } from '@/lib/crud/configs/order-details'
import prisma from '@/lib/prisma'

const ALLOWED_BATCH_FIELDS = new Set(['window_period'])

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(orderDetailConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error
    const userId = permissionResult.user?.id ? BigInt(permissionResult.user.id) : null

    const body = await request.json()
    const { ids, updates } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请提供要更新的记录ID列表' }, { status: 400 })
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '请提供要更新的字段' }, { status: 400 })
    }

    const updateKeys = Object.keys(updates)
    const disallowed = updateKeys.filter((k) => !ALLOWED_BATCH_FIELDS.has(k))
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `不允许批量修改字段：${disallowed.join('、')}` },
        { status: 400 }
      )
    }
    if (!updateKeys.includes('window_period')) {
      return NextResponse.json({ error: '请填写要修改的窗口期' }, { status: 400 })
    }

    const bigIntIds = ids.map((id: string | number) => BigInt(id))
    const raw = updates.window_period
    const data = {
      window_period:
        raw === null || raw === undefined || String(raw).trim() === ''
          ? null
          : String(raw).trim(),
      updated_at: new Date(),
      updated_by: userId,
    }

    const result = await prisma.order_detail.updateMany({
      where: { id: { in: bigIntIds } },
      data,
    })

    return NextResponse.json({
      message: `成功更新 ${result.count} 条记录`,
      count: result.count,
    })
  } catch (error: unknown) {
    return handleError(error, '批量更新订单明细失败')
  }
}
