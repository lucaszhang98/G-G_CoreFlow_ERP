import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, addSystemFields } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/** POST - 更新当前页拖拽后的 manual_sort_order */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const updates = body?.updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates 不能为空' }, { status: 400 })
    }

    const user = authResult.user || null

    await prisma.$transaction(async (tx) => {
      for (const item of updates as Array<{ pickup_id?: string; manual_sort_order?: number }>) {
        const pickupId = item?.pickup_id
        const sortOrder = item?.manual_sort_order
        if (!pickupId || sortOrder == null || Number.isNaN(Number(sortOrder))) {
          throw new Error('updates 项缺少 pickup_id 或 manual_sort_order')
        }
        const data: Record<string, unknown> = {
          manual_sort_order: Number(sortOrder),
        }
        await addSystemFields(data, user, false, true)
        await tx.pickup_management.update({
          where: { pickup_id: BigInt(String(pickupId)) },
          data,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[提柜管理 reorder] 失败:', error)
    const message = error instanceof Error ? error.message : '更新行顺序失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
