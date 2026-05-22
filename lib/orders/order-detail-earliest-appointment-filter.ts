/**
 * 订单明细列表：按「最早预约时间」（计算字段）筛选。
 * 最早预约 = 该明细下仍启用预约中 confirmed_start / requested_start 最早的一条。
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { prismaAppointmentDetailLinesWhereParentAppointmentActive } from '@/lib/utils/delivery-appointment-enabled'

/** 与列表 API 日期筛选一致：YYYY-MM-DD 按 UTC 日界 */
export function parseOrderDetailFilterDayStart(s: string): Date {
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`)
  }
  return new Date(trimmed)
}

export function parseOrderDetailFilterDayEnd(s: string): Date {
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59.999Z`)
  }
  return new Date(trimmed)
}

function appointmentStartMs(
  confirmed: Date | null | undefined,
  requested: Date | null | undefined
): number | null {
  const start = confirmed ?? requested
  if (!start) return null
  const ms = start.getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * 在已构建的 order_detail where（含入库/操作方式等）下，找出「最早预约时间」落在范围内的明细 id。
 */
export async function findOrderDetailIdsByEarliestAppointmentTime(
  orderDetailWhere: Prisma.order_detailWhereInput,
  from: string | null,
  to: string | null
): Promise<bigint[]> {
  const fromStr = from?.trim() || ''
  const toStr = to?.trim() || ''
  if (!fromStr && !toStr) return []

  const fromDate = fromStr ? parseOrderDetailFilterDayStart(fromStr) : null
  const toDate = toStr ? parseOrderDetailFilterDayEnd(toStr) : null
  if (fromDate && Number.isNaN(fromDate.getTime())) return []
  if (toDate && Number.isNaN(toDate.getTime())) return []

  const lines = await prisma.appointment_detail_lines.findMany({
    where: {
      ...prismaAppointmentDetailLinesWhereParentAppointmentActive,
      order_detail: orderDetailWhere,
    },
    select: {
      order_detail_id: true,
      delivery_appointments: {
        select: {
          confirmed_start: true,
          requested_start: true,
        },
      },
    },
  })

  const earliestMsByDetail = new Map<bigint, number>()

  for (const line of lines) {
    const appt = line.delivery_appointments
    if (!appt) continue
    const ms = appointmentStartMs(appt.confirmed_start, appt.requested_start)
    if (ms === null) continue
    const odId = line.order_detail_id
    const prev = earliestMsByDetail.get(odId)
    if (prev === undefined || ms < prev) {
      earliestMsByDetail.set(odId, ms)
    }
  }

  const fromMs = fromDate?.getTime() ?? null
  const toMs = toDate?.getTime() ?? null

  const ids: bigint[] = []
  for (const [odId, ms] of earliestMsByDetail) {
    if (fromMs !== null && ms < fromMs) continue
    if (toMs !== null && ms > toMs) continue
    ids.push(odId)
  }

  return ids
}

export function intersectOrderDetailIdFilter(
  existing: Prisma.order_detailWhereInput['id'],
  ids: bigint[]
): { in: bigint[] } {
  if (ids.length === 0) return { in: [] }
  if (!existing || typeof existing !== 'object' || !('in' in existing)) {
    return { in: ids }
  }
  const existingIn = (existing as { in: bigint[] }).in
  const allowed = new Set(ids.map((id) => id.toString()))
  return {
    in: existingIn.filter((id) => allowed.has(id.toString())),
  }
}
