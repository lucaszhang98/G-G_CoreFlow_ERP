/**
 * 未约板数/剩余板数重算服务
 *
 * 公式（含拒收板数）：
 * - 有效占用 = estimated_pallets - (rejected_pallets ?? 0)
 * - 未约板数 = 预计/实际板数 - sum(有效占用)（允许负数，表示已超约）
 * - 剩余板数 = 实际板数 - sum(已过期预约的有效占用)（允许负数，表示已超送）
 *
 * 在预约明细增/改/删或拒收板数变更后调用，保证 DB 存库与公式一致。
 * 当用户将实际板数改为 0 且仍有预约时，未约/剩余会为负，正常落库并展示。
 */

import prisma from '@/lib/prisma'

function getEffectivePallets(estimated: number, rejected: number | null | undefined): number {
  return estimated - (rejected ?? 0)
}

/**
 * 为单个 order_detail_id 重算并写回未约板数、剩余板数
 * @param orderDetailId 订单明细 ID
 * @param tx 可选，传入则在同一事务内执行（用于预约明细 create/update/delete 后立即回写）
 */
export async function recalcUnbookedRemainingForOrderDetail(
  orderDetailId: bigint,
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = prisma
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 1. 该 order_detail 下所有预约明细（含有效占用、是否过期）
  const lines = await tx.appointment_detail_lines.findMany({
    where: { order_detail_id: orderDetailId },
    select: {
      estimated_pallets: true,
      rejected_pallets: true,
      delivery_appointments: {
        select: { confirmed_start: true },
      },
    },
  })

  const totalEffective = lines.reduce((sum, line) => {
    return sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets)
  }, 0)

  const expiredEffective = lines.reduce((sum, line) => {
    const start = line.delivery_appointments?.confirmed_start
    if (!start) return sum
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    if (d < today) return sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets)
    return sum
  }, 0)

  // 2. 是否已入库
  const lots = await tx.inventory_lots.findMany({
    where: { order_detail_id: orderDetailId },
    select: { inventory_lot_id: true, pallet_count: true },
  })

  if (lots.length > 0) {
    for (const lot of lots) {
      const palletCount = lot.pallet_count ?? 0
      const unbooked = palletCount - totalEffective
      const remaining = palletCount - expiredEffective
      await tx.inventory_lots.update({
        where: { inventory_lot_id: lot.inventory_lot_id },
        data: {
          unbooked_pallet_count: unbooked,
          remaining_pallet_count: remaining,
        },
      })
    }
  } else {
    const detail = await tx.order_detail.findUnique({
      where: { id: orderDetailId },
      select: { estimated_pallets: true },
    })
    if (detail) {
      const estimated = detail.estimated_pallets ?? 0
      const newRemaining = estimated - totalEffective
      await tx.order_detail.update({
        where: { id: orderDetailId },
        data: { remaining_pallets: newRemaining },
      })
    }
  }
}

/**
 * 为多个 order_detail_id 重算并写回（用于整单预约删除后批量回写）
 */
export async function recalcUnbookedRemainingForOrderDetails(
  orderDetailIds: bigint[],
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> = prisma
): Promise<void> {
  const seen = new Set<string>()
  for (const id of orderDetailIds) {
    const key = id.toString()
    if (seen.has(key)) continue
    seen.add(key)
    await recalcUnbookedRemainingForOrderDetail(id, tx)
  }
}
