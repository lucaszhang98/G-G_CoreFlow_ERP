/**
 * 提柜侧触发入库联动（**仅查验/封闭区**）：
 * - 现在位置含「查验」=> status=inspection；含「封闭区」=> status=closed_area；未填拆柜人员时清空拆柜日期
 * - 库内原为查验/封闭区、现在位置已不含关键词 => 改回待处理，未填拆柜人员时按提柜/ETA 重算拆柜日期
 * - 仅改提柜日/ETA/普通现在位置 => **不修改** inbound_receipt（预计窗口期仍走 OMS 同步）
 * - 已填拆柜人员：仅同步 status，不自动改 planned_unload_at
 */
import prisma from '@/lib/prisma'
import { syncAppointmentEstimatedWindowPeriodForOrder } from '@/lib/oms/sync-appointment-estimated-window-period'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  buildInboundInspectionAreaSyncPatch,
  shouldSyncInboundFromPickupLocation,
} from '@/lib/wms/current-location-blocks-unload'
import { isInboundPlannedUnloadAtAutoUpdateBlocked } from '@/lib/wms/planned-unload-auto-update'

export {
  includesInspectionKeyword,
  includesClosedAreaKeyword,
  currentLocationBlocksPlannedUnload,
  resolveInboundStatusFromCurrentLocation,
  inboundStatusBlocksUnload,
  inboundRowShouldHighlightAsInspection,
  shouldSyncInboundFromPickupLocation,
  buildInboundInspectionAreaSyncPatch,
} from '@/lib/wms/current-location-blocks-unload'

export async function syncInboundPlannedUnloadAtByPickupState(args: {
  orderId: bigint
  userId: bigint | null
  /** 提柜导入等场景已单独同步过预计窗口期时为 true，避免重复写库 */
  skipAppointmentSync?: boolean
}): Promise<void> {
  const { orderId, userId, skipAppointmentSync = false } = args
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
      select: {
        inbound_receipt_id: true,
        unloaded_by: true,
        status: true,
        planned_unload_at: true,
      },
    }),
  ])

  if (!order) return

  if (!skipAppointmentSync) {
    await syncAppointmentEstimatedWindowPeriodForOrder({
      orderId,
      pickupDate: order.pickup_date,
    })
  }

  if (!inbound) return

  // 正常柜（非查验/封闭区、且库内非查验/封闭区）：只同步预计窗口期，不改入库 status/拆柜日
  if (
    !shouldSyncInboundFromPickupLocation(
      pickup?.current_location,
      inbound.status
    )
  ) {
    return
  }

  const patch = buildInboundInspectionAreaSyncPatch({
    currentLocation: pickup?.current_location,
    storedStatus: inbound.status,
    storedPlannedUnloadAt: inbound.planned_unload_at,
    pickupDate: order.pickup_date,
    etaDate: order.eta_date,
    blockAutoPlannedUnloadAt: isInboundPlannedUnloadAtAutoUpdateBlocked(
      inbound.unloaded_by
    ),
    recalculatePlannedUnloadAt: calculateUnloadDate,
  })

  if (!patch) return

  await prisma.inbound_receipt.update({
    where: { inbound_receipt_id: inbound.inbound_receipt_id },
    data: {
      ...patch,
      updated_by: userId,
      updated_at: new Date(),
    },
  })
}
