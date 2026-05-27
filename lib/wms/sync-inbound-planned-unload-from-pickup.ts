/**
 * 按提柜「现在位置」与订单提柜/ETA，将入库拆柜日期与状态与数据库对齐。
 * - 现在位置含「查验」=> status=inspection；含「封闭区」=> status=closed_area；均清空拆柜日期
 * - 否则（含从查验/封闭区改为其他现在位置）=> 状态固定改回待处理，拆柜日期按提柜/ETA重算
 */
import prisma from '@/lib/prisma'
import { syncAppointmentEstimatedWindowPeriodForOrder } from '@/lib/oms/sync-appointment-estimated-window-period'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import { resolveInboundStatusFromCurrentLocation } from '@/lib/wms/current-location-blocks-unload'

export {
  includesInspectionKeyword,
  includesClosedAreaKeyword,
  currentLocationBlocksPlannedUnload,
  resolveInboundStatusFromCurrentLocation,
  inboundStatusBlocksUnload,
  inboundRowShouldHighlightAsInspection,
} from '@/lib/wms/current-location-blocks-unload'

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

  if (!order) return

  await syncAppointmentEstimatedWindowPeriodForOrder({
    orderId,
    pickupDate: order.pickup_date,
  })

  if (!inbound) return

  const resolvedStatus = resolveInboundStatusFromCurrentLocation(
    pickup?.current_location
  )
  const plannedUnloadAt = resolvedStatus
    ? null
    : calculateUnloadDate(order.pickup_date, order.eta_date)

  await prisma.inbound_receipt.update({
    where: { inbound_receipt_id: inbound.inbound_receipt_id },
    data: {
      status: resolvedStatus ?? 'pending',
      planned_unload_at: plannedUnloadAt,
      updated_by: userId,
      updated_at: new Date(),
    },
  })
}
