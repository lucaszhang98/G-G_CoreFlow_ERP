/**
 * 订单明细列表：未约板数计算（与 GET /api/oms/order-details 展示口径一致）
 */

import type { Prisma } from '@prisma/client'
import {
  computeInboundOrderDetailDeliveryState,
  resolveAppointmentsFromOrderDetail,
} from '@/lib/utils/inbound-delivery-progress'

export type OrderDetailRowForUnbookedCalc = {
  estimated_pallets: number | null
  inventory_lots: Array<{
    pallet_count: number | null
    pallet_counts_verified?: boolean | null
    remaining_pallet_count?: number | null
    unbooked_pallet_count?: number | null
  }>
  appointment_detail_lines: Array<{
    estimated_pallets?: number | null
    rejected_pallets?: number | null
    delivery_appointments?: {
      confirmed_start?: Date | null
      requested_start?: Date | null
      enabled?: boolean | null
    } | null
  }>
}

const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)

/** 与列表 API transform 一致：已入库走 delivery state；未入库为预计板数 − 有效预约板数 */
export function computeOrderDetailUnbookedPallets(row: OrderDetailRowForUnbookedCalc): number {
  const validLines = (row.appointment_detail_lines || []).filter(
    (adl) => adl.delivery_appointments != null
  )
  const totalEffectivePallets = validLines.reduce(
    (sum, adl) => sum + effective(adl.estimated_pallets ?? 0, adl.rejected_pallets),
    0
  )

  const lots = row.inventory_lots || []
  if (lots.length > 0) {
    const lotsForCalc = lots.map((lot) => ({
      pallet_count: lot.pallet_count,
      pallet_counts_verified: lot.pallet_counts_verified === true,
      remaining_pallet_count: lot.remaining_pallet_count,
      unbooked_pallet_count: lot.unbooked_pallet_count,
    }))
    const appointmentsResolved = resolveAppointmentsFromOrderDetail({
      appointment_detail_lines: validLines,
    })
    const state = computeInboundOrderDetailDeliveryState({
      lots: lotsForCalc,
      estimatedPallets: row.estimated_pallets,
      appointments: appointmentsResolved,
    })
    if (state) return state.totalUnbookedPalletCount
  }

  return (row.estimated_pallets || 0) - totalEffectivePallets
}

export function matchesBookingStatusFilter(
  unbooked: number,
  filterValue: string
): boolean {
  switch (filterValue) {
    case 'unbooked':
      return unbooked > 0
    case 'fully_booked':
      return unbooked === 0
    case 'overbooked':
      return unbooked < 0
    default:
      return true
  }
}

/** 列表 API 与 inventory_lots 子查询一致：优先板数最大、其次最新的一条批次 */
export const orderDetailListInventoryLotSelect = {
  pallet_count: true,
  pallet_counts_verified: true,
  remaining_pallet_count: true,
  unbooked_pallet_count: true,
} as const

export const orderDetailListInventoryLotOrderBy = [
  { pallet_count: 'desc' as const },
  { created_at: 'desc' as const },
]

export const orderDetailListAppointmentLineSelect = {
  estimated_pallets: true,
  rejected_pallets: true,
  delivery_appointments: {
    select: {
      confirmed_start: true,
      requested_start: true,
      enabled: true,
    },
  },
} as const

export function buildOrderDetailUnbookedCalcSelect(
  appointmentLinesWhere: Prisma.appointment_detail_linesWhereInput
): Prisma.order_detailSelect {
  return {
    id: true,
    estimated_pallets: true,
    inventory_lots: {
      select: orderDetailListInventoryLotSelect,
      orderBy: orderDetailListInventoryLotOrderBy,
      take: 1,
    },
    appointment_detail_lines: {
      where: appointmentLinesWhere,
      select: orderDetailListAppointmentLineSelect,
    },
  }
}
