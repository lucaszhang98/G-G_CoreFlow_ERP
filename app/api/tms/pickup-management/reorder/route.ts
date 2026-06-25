import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { checkAuth } from '@/lib/api/helpers'
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

    const userId = authResult.user?.id ? BigInt(String(authResult.user.id)) : null

    const ids: bigint[] = []
    const cases: Prisma.Sql[] = []
    for (const item of updates as Array<{ pickup_id?: string; manual_sort_order?: number }>) {
      const pickupId = item?.pickup_id
      const sortOrder = item?.manual_sort_order
      if (!pickupId || sortOrder == null || Number.isNaN(Number(sortOrder))) {
        return NextResponse.json(
          { error: 'updates 项缺少 pickup_id 或 manual_sort_order' },
          { status: 400 }
        )
      }
      const id = BigInt(String(pickupId))
      ids.push(id)
      cases.push(Prisma.sql`WHEN ${id} THEN ${Number(sortOrder)}`)
    }

    // 单条批量更新：避免逐行 update 串行执行导致交互式事务超时（Transaction not found）
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "tms"."pickup_management"
      SET "manual_sort_order" = CASE "pickup_id" ${Prisma.join(cases, ' ')} END,
          "updated_by" = ${userId},
          "updated_at" = NOW()
      WHERE "pickup_id" IN (${Prisma.join(ids)})
    `)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[提柜管理 reorder] 失败:', error)
    const message = error instanceof Error ? error.message : '更新行顺序失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
