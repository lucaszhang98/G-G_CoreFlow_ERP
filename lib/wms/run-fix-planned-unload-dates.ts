/**
 * 批量修复入库拆柜日期（与 POST fix-planned-unload-dates API 逻辑一致）。
 */
import prisma from '@/lib/prisma'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  currentLocationBlocksPlannedUnload,
  pickupCurrentLocationBlocksUnloadWhere,
  resolveInboundStatusFromCurrentLocation,
} from '@/lib/wms/current-location-blocks-unload'
import { isInboundPlannedUnloadAtAutoUpdateBlocked } from '@/lib/wms/planned-unload-auto-update'

export interface FixPlannedUnloadDatesErrorRow {
  inbound_receipt_id: string
  order_number: string
  error: string
}

export interface RunFixPlannedUnloadDatesResult {
  success: boolean
  message: string
  cleared_stale_inspection_dates: number
  status_synced: number
  fixed: number
  failed: number
  total_candidates: number
  errors: FixPlannedUnloadDatesErrorRow[]
}

export async function runFixPlannedUnloadDates(): Promise<RunFixPlannedUnloadDatesResult> {
  const cleared = await prisma.inbound_receipt.updateMany({
    where: {
      planned_unload_at: { not: null },
      unloaded_by: null,
      orders: {
        pickup_management: pickupCurrentLocationBlocksUnloadWhere(),
      },
    },
    data: {
      planned_unload_at: null,
      updated_at: new Date(),
    },
  })

  const pickupRows = await prisma.inbound_receipt.findMany({
    where: {
      orders: {
        pickup_management: pickupCurrentLocationBlocksUnloadWhere(),
      },
    },
    select: {
      inbound_receipt_id: true,
      status: true,
      planned_unload_at: true,
      unloaded_by: true,
      orders: {
        select: {
          pickup_management: {
            select: { current_location: true },
          },
        },
      },
    },
  })

  let statusSynced = 0
  for (const row of pickupRows) {
    const loc = row.orders?.pickup_management?.current_location
    const expectedStatus = resolveInboundStatusFromCurrentLocation(loc)
    if (!expectedStatus) continue
    if (row.status === expectedStatus && row.planned_unload_at === null) continue
    const data: { status: string; updated_at: Date; planned_unload_at?: null } = {
      status: expectedStatus,
      updated_at: new Date(),
    }
    if (!isInboundPlannedUnloadAtAutoUpdateBlocked(row.unloaded_by)) {
      data.planned_unload_at = null
    }
    await prisma.inbound_receipt.update({
      where: { inbound_receipt_id: row.inbound_receipt_id },
      data,
    })
    statusSynced++
  }

  const inboundReceipts = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: null,
      unloaded_by: null,
    },
    include: {
      orders: {
        select: {
          order_id: true,
          order_number: true,
          pickup_date: true,
          eta_date: true,
          pickup_management: {
            select: { current_location: true },
          },
        },
      },
    },
  })

  const results = {
    fixed: 0,
    failed: 0,
    errors: [] as FixPlannedUnloadDatesErrorRow[],
  }

  for (const receipt of inboundReceipts) {
    try {
      const loc = receipt.orders.pickup_management?.current_location
      if (currentLocationBlocksPlannedUnload(loc)) {
        continue
      }

      const calculatedUnloadDate = calculateUnloadDate(
        receipt.orders.pickup_date,
        receipt.orders.eta_date
      )

      if (calculatedUnloadDate) {
        await prisma.inbound_receipt.update({
          where: { inbound_receipt_id: receipt.inbound_receipt_id },
          data: {
            planned_unload_at: calculatedUnloadDate,
            updated_at: new Date(),
          },
        })
        results.fixed++
      } else {
        results.failed++
        results.errors.push({
          inbound_receipt_id: String(receipt.inbound_receipt_id),
          order_number: receipt.orders.order_number || '未知',
          error: '订单缺少提柜日期和到港日期，无法计算拆柜日期',
        })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新失败'
      results.failed++
      results.errors.push({
        inbound_receipt_id: String(receipt.inbound_receipt_id),
        order_number: receipt.orders.order_number || '未知',
        error: message,
      })
    }
  }

  const message =
    inboundReceipts.length === 0
      ? `查验/封闭区拆柜日期已清理 ${cleared.count} 条、状态同步 ${statusSynced} 条；无待回填记录`
      : `查验/封闭区拆柜日期已清理 ${cleared.count} 条、状态同步 ${statusSynced} 条；回填完成：成功 ${results.fixed} 条，失败 ${results.failed} 条`

  return {
    success: true,
    message,
    cleared_stale_inspection_dates: cleared.count,
    status_synced: statusSynced,
    fixed: results.fixed,
    failed: results.failed,
    total_candidates: inboundReceipts.length,
    errors: results.errors,
  }
}
