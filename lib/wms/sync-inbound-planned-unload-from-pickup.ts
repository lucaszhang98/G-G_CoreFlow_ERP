/**
 * 提柜侧触发入库联动：
 * 1. 进入查验/封闭区（新现在位置含关键词）=> status + 清空拆柜日
 * 2. 放出（库内原为查验/封闭区且新位置无关键词）=> 待处理 + 重算拆柜日
 * 3. 正常柜 => 仅按老逻辑重算拆柜日（不改 status）
 */
import prisma from '@/lib/prisma'
import { syncAppointmentEstimatedWindowPeriodForOrder } from '@/lib/oms/sync-appointment-estimated-window-period'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  buildInboundInspectionAreaSyncPatch,
  buildNormalPlannedUnloadSyncPatch,
  inboundStatusBlocksUnload,
  isInboundWorkflowStatus,
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

/** 构造入库写入字段：正常柜重算拆柜日时绝不带 status（堵住历史「一律 pending」） */
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

  if (allowStatusChange && patch.status !== undefined) {
    if (isInboundWorkflowStatus(inboundStatus)) {
      // 已打印/已入库/已到仓：丢弃 status
    } else if (
      patch.status === 'pending' &&
      !inboundStatusBlocksUnload(inboundStatus)
    ) {
      // 禁止把普通柜 sync 成 pending（仅允许从 inspection/closed_area 放出）
    } else if (patch.status !== inboundStatus) {
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
