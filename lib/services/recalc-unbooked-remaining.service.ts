/**
 * 未约板数/剩余板数重算服务
 *
 * 公式（含拒收板数）：
 * - 有效占用 = estimated_pallets - (rejected_pallets ?? 0)
 * - 未约板数 = 预计/实际板数 - sum(有效占用)（允许负数，表示已超约）
 * - 剩余板数 = 基准板数 - sum(已到期预约的有效占用)（含当日，与 getTotalExpiredEffectivePallets 一致）
 *
 * 在预约明细增/改/删或拒收板数变更后调用，保证 DB 存库与公式一致。
 * 基准板数见 basePalletCountForCalc：null=未填按预计，0=明确零。
 */

import prisma from '@/lib/prisma'
import { basePalletCountForCalc } from '@/lib/utils/pallet-base'
import { isDeliveryAppointmentEnabled } from '@/lib/utils/delivery-appointment-enabled'

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
  // 只包含有效的预约（delivery_appointments 不为 null），过滤掉孤立的记录
  const allLines = await tx.appointment_detail_lines.findMany({
    where: { order_detail_id: orderDetailId },
    select: {
      estimated_pallets: true,
      rejected_pallets: true,
      delivery_appointments: {
        select: { confirmed_start: true, enabled: true },
      },
    },
  })

  // 过滤孤立行；停用（软删）的预约上的明细不计入占用
  const validLines = allLines.filter(
    (line) =>
      line.delivery_appointments !== null &&
      isDeliveryAppointmentEnabled(line.delivery_appointments.enabled)
  )

  const totalEffective = validLines.reduce((sum, line) => {
    return sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets)
  }, 0)

  const expiredEffective = validLines.reduce((sum, line) => {
    const start = line.delivery_appointments?.confirmed_start
    if (!start) return sum
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    if (d <= today) return sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets)
    return sum
  }, 0)

  // 调试日志：如果存在孤立的记录，记录警告
  const excluded = allLines.filter(
    (line) =>
      line.delivery_appointments === null ||
      !isDeliveryAppointmentEnabled(line.delivery_appointments?.enabled)
  )
  if (excluded.length > 0) {
    const orphanedPallets = excluded
      .filter((line) => line.delivery_appointments === null)
      .reduce((sum, line) => sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets), 0)
    const disabledPallets = excluded
      .filter(
        (line) =>
          line.delivery_appointments !== null &&
          !isDeliveryAppointmentEnabled(line.delivery_appointments.enabled)
      )
      .reduce((sum, line) => sum + getEffectivePallets(line.estimated_pallets, line.rejected_pallets), 0)
    if (orphanedPallets > 0) {
      const orphanedCount = excluded.filter((l) => l.delivery_appointments === null).length
      console.warn(
        `[重算服务] 订单明细 ${orderDetailId} 存在 ${orphanedCount} 条孤立预约明细（预约已不存在），共 ${orphanedPallets} 个有效板数，不计入未约板数。`
      )
    }
    if (disabledPallets > 0) {
      console.log(
        `[重算服务] 订单明细 ${orderDetailId} 有已停用预约上的明细共 ${disabledPallets} 板，不计入未约板数。`
      )
    }
  }

  // 2. 是否已入库
  const lots = await tx.inventory_lots.findMany({
    where: { order_detail_id: orderDetailId },
    select: { inventory_lot_id: true, pallet_count: true, pallet_counts_verified: true },
  })

  if (lots.length > 0) {
    const detailRow = await tx.order_detail.findUnique({
      where: { id: orderDetailId },
      select: { estimated_pallets: true },
    })
    const estimatedPallets = detailRow?.estimated_pallets ?? null

    for (const lot of lots) {
      if (lot.pallet_counts_verified === true) continue
      const basePallets = basePalletCountForCalc(lot.pallet_count, estimatedPallets)
      const unbooked = basePallets - totalEffective
      const remaining = basePallets - expiredEffective
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
