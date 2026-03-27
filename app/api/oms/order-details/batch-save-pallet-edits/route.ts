import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'
import { orderDetailConfig } from '@/lib/crud/configs/order-details'

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        inventory_lot_id: z.string().min(1),
        remaining_pallet_count: z.number().int(),
        unbooked_pallet_count: z.number().int(),
        pallet_counts_verified: z.literal(true),
      })
    )
    .min(1),
})

/**
 * POST /api/oms/order-details/batch-save-pallet-edits
 * 批量保存本页手改的剩余板数、冻结的未约板数，并标记已校验（后续 recalc 跳过）。
 */
export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(orderDetailConfig.permissions.update)
    if (permissionResult.error) return permissionResult.error

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求体无效', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items } = parsed.data

    await prisma.$transaction(
      items.map((item) =>
        prisma.inventory_lots.update({
          where: { inventory_lot_id: BigInt(item.inventory_lot_id) },
          data: {
            remaining_pallet_count: item.remaining_pallet_count,
            unbooked_pallet_count: item.unbooked_pallet_count,
            pallet_counts_verified: true,
          },
        })
      )
    )

    return NextResponse.json({ success: true, updated: items.length })
  } catch (error: any) {
    console.error('[batch-save-pallet-edits]', error)
    return NextResponse.json(
      { error: error?.message || '保存失败' },
      { status: 500 }
    )
  }
}
