/**
 * 提柜侧触发入库联动：
 * 1. 进入：新现在位置含「查验」/「封闭区」=> 对应 status + 清空拆柜日（可覆盖已打印/已入库/已到仓）
 * 2. 放出：且仅当库内 status 为查验/封闭区，且更新前位置含关键词、更新后不含 => 待处理 + 按提柜/ETA 重算拆柜日
 * 3. 正常柜：只重算拆柜日，绝不把 status 写成待处理
 */
import prisma from '@/lib/prisma'
import { syncAppointmentEstimatedWindowPeriodForOrder } from '@/lib/oms/sync-appointment-estimated-window-period'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  buildInboundInspectionAreaSyncPatch,
  buildNormalPlannedUnloadSyncPatch,
  inboundStatusBlocksUnload,
  type InboundInspectionAreaSyncPatch,
} from '@/lib/wms/current-location-blocks-unload'
import { isInboundPlannedUnloadAtAutoUpdateBlocked } from '@/lib/wms/planned-unload-auto-update'

export {
  includesInspectionKeyword,
  includesClosedAreaKeyword,
  currentLocationBlocksPlannedUnload,
  resolveInboundStatusFromCurrentLocation,
  inboundStatusBlocksUnload,
  inboundRowShouldHighlightAsInspection,
  isEnteringInspectionArea,
  isExitingInspectionArea,
  shouldSyncInboundFromPickupLocation,
  buildInboundInspectionAreaSyncPatch,
  buildNormalPlannedUnloadSyncPatch,
} from '@/lib/wms/current-location-blocks-unload'

function buildInboundSyncUpdateData(args: {
  inboundStatus: string
  patch: InboundInspectionAreaSyncPatch
  allowStatusChange: boolean
  userId: bigint | null
}): Record<string, unknown> | null {
  const { inboundStatus, patch, allowStatusChange, userId } = args
  const data: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date(),
  }
  let hasBusinessField = false

  if (patch.planned_unload_at !== undefined) {
    data.planned_unload_at = patch.planned_unload_at
    hasBusinessField = true
  }

  if (allowStatusChange && patch.status !== undefined && patch.status !== inboundStatus) {
    if (patch.status === 'pending') {
      // 仅允许：库内原为查验/封闭区，且正在「放出」（由 buildInboundInspectionAreaSyncPatch 判定）
      if (inboundStatusBlocksUnload(inboundStatus)) {
        data.status = patch.status
        hasBusinessField = true
      }
    } else {
      // 进入查验/封闭区：允许从已打印/待处理等变为 inspection / closed_area
      data.status = patch.status
      hasBusinessField = true
    }
  }

  return hasBusinessField ? data : null
}

export async function syncInboundPlannedUnloadAtByPickupState(args: {
  orderId: bigint
  userId: bigint | null
  /** 更新前的提柜现在位置（判断「放出」瞬间；导入/改位置时必传） */
  previousLocation?: string | null
  skipAppointmentSync?: boolean
  /** 提柜日/ETA 变更时，正常柜也按老逻辑重算拆柜日期 */
  recalcNormalPlannedUnload?: boolean
}): Promise<void> {
  const {
    orderId,
    userId,
    previousLocation,
    skipAppointmentSync = false,
    recalcNormalPlannedUnload = false,
  } = args

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

  const blockAutoPlannedUnloadAt = isInboundPlannedUnloadAtAutoUpdateBlocked(
    inbound.unloaded_by
  )
  const recalc = calculateUnloadDate

  const inspectionPatch = buildInboundInspectionAreaSyncPatch({
    previousLocation,
    currentLocation: pickup?.current_location,
    storedStatus: inbound.status,
    storedPlannedUnloadAt: inbound.planned_unload_at,
    pickupDate: order.pickup_date,
    etaDate: order.eta_date,
    blockAutoPlannedUnloadAt,
    recalculatePlannedUnloadAt: recalc,
  })

  if (inspectionPatch) {
    const data = buildInboundSyncUpdateData({
      inboundStatus: inbound.status,
      patch: inspectionPatch,
      allowStatusChange: true,
      userId,
    })
    if (data) {
      await prisma.inbound_receipt.update({
        where: { inbound_receipt_id: inbound.inbound_receipt_id },
        data,
      })
    }
    return
  }

  if (!recalcNormalPlannedUnload) return

  const datePatch = buildNormalPlannedUnloadSyncPatch({
    storedPlannedUnloadAt: inbound.planned_unload_at,
    pickupDate: order.pickup_date,
    etaDate: order.eta_date,
    blockAutoPlannedUnloadAt,
    recalculatePlannedUnloadAt: recalc,
  })
  if (!datePatch) return

  const data = buildInboundSyncUpdateData({
    inboundStatus: inbound.status,
    patch: datePatch,
    allowStatusChange: false,
    userId,
  })
  if (!data) return

  await prisma.inbound_receipt.update({
    where: { inbound_receipt_id: inbound.inbound_receipt_id },
    data,
  })
}
