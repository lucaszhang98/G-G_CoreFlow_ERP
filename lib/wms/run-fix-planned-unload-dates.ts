/**
 * 批量修复入库拆柜日期（与 POST fix-planned-unload-dates API 逻辑一致）。
 */
import prisma from '@/lib/prisma'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'
import {
  includesInspectionKeyword,
  pickupCurrentLocationBlocksUnloadWhere,
} from '@/lib/wms/current-location-blocks-unload'

export interface FixPlannedUnloadDatesErrorRow {
  inbound_receipt_id: string
  order_number: string
  error: string
}

export interface RunFixPlannedUnloadDatesResult {
  success: boolean
  message: string
  cleared_stale_inspection_dates: number
  fixed: number
  failed: number
  total_candidates: number
  errors: FixPlannedUnloadDatesErrorRow[]
}

export async function runFixPlannedUnloadDates(): Promise<RunFixPlannedUnloadDatesResult> {
  const cleared = await prisma.inbound_receipt.updateMany({
    where: {
      planned_unload_at: { not: null },
      orders: {
        pickup_management: pickupCurrentLocationBlocksUnloadWhere(),
      },
    },
    data: {
      planned_unload_at: null,
      status: 'inspection',
      updated_at: new Date(),
    },
  })

  const statusSynced = await prisma.inbound_receipt.updateMany({
    where: {
      status: { not: 'inspection' },
      orders: {
        pickup_management: pickupCurrentLocationBlocksUnloadWhere(),
      },
    },
    data: {
      status: 'inspection',
      planned_unload_at: null,
      updated_at: new Date(),
    },
  })

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
      if (includesInspectionKeyword(loc)) {
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
      ? '没有需要按规则回填的记录'
      : `查验/封闭区脏数据已清理 ${cleared.count} 条、状态同步 ${statusSynced.count} 条；回填完成：成功 ${results.fixed} 条，失败 ${results.failed} 条`

  return {
    success: true,
    message,
    cleared_stale_inspection_dates: cleared.count,
    fixed: results.fixed,
    failed: results.failed,
    total_candidates: inboundReceipts.length,
    errors: results.errors,
  }
}
