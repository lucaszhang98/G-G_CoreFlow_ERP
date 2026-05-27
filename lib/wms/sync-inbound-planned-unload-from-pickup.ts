/**
 * 按提柜「现在位置」与订单提柜/ETA，将入库拆柜日期与状态与数据库对齐。
 * - 现在位置含「查验」或「封闭区」=> 拆柜日期置空、入库状态=inspection（查验）
 * - 否则 => 状态=待处理、拆柜日期按 calculateUnloadDate(pickup_date, eta_date)
 */
import prisma from '@/lib/prisma'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import { includesInspectionKeyword } from '@/lib/wms/current-location-blocks-unload'

export { includesInspectionKeyword } from '@/lib/wms/current-location-blocks-unload'

export async function syncInboundPlannedUnloadAtByPickupState(args: {
  orderId: bigint
  userId: bigint | null
}): Promise<void> {
  const { orderId, userId } = args
  const [order, pickup, inbound] = await Promise.all([
    prisma.orders.findUnique({
      where: { order_id: orderId },
      select: { pickup_date: true, eta_date: true },
    }),
    prisma.pickup_management.findUnique({
      where: { order_id: orderId },
      select: { current_location: true },
    }),
    prisma.inbound_receipt.findUnique({
      where: { order_id: orderId },
      select: { inbound_receipt_id: true },
    }),
  ])

  if (!order || !inbound) return

  const inspection = includesInspectionKeyword(pickup?.current_location)
  const plannedUnloadAt = inspection ? null : calculateUnloadDate(order.pickup_date, order.eta_date)

  await prisma.inbound_receipt.update({
    where: { inbound_receipt_id: inbound.inbound_receipt_id },
    data: {
      status: inspection ? 'inspection' : 'pending',
      planned_unload_at: plannedUnloadAt,
      updated_by: userId,
      updated_at: new Date(),
    },
  })
}
