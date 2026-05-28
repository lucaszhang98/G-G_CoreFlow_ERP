import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  dateOnlyPart,
  formatEstimatedWindowPeriodForApi,
  pickupDateToEstimatedWindowPeriod,
} from '@/lib/oms/estimated-window-period'

/**
 * 列表/接口展示：未锁定时按当前提柜日+3；已锁定用库内值。
 */
export function resolveEstimatedWindowPeriodForLine(args: {
  stored: Date | string | null | undefined
  locked: boolean
  pickupDate: Date | string | null | undefined
}): string | null {
  if (args.locked) {
    return formatEstimatedWindowPeriodForApi(args.stored)
  }
  const fromPickup = pickupDateToEstimatedWindowPeriod(args.pickupDate)
  if (fromPickup) {
    return formatEstimatedWindowPeriodForApi(fromPickup)
  }
  return formatEstimatedWindowPeriodForApi(args.stored)
}

/**
 * 打开预约明细时：对该预约下存在未锁定明细的订单，按当前提柜日回填预计窗口期。
 *（创建明细时无提柜日、之后补录提柜日的场景）
 */
export async function syncEstimatedWindowPeriodForAppointment(
  appointmentId: bigint,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma
  const lines = await client.appointment_detail_lines.findMany({
    where: {
      appointment_id: appointmentId,
      estimated_window_period_locked: false,
    },
    select: {
      order_detail: {
        select: { order_id: true },
      },
    },
  })
  const orderIds = [
    ...new Set(
      lines
        .map((l) => l.order_detail?.order_id)
        .filter((id): id is bigint => id != null)
    ),
  ]
  for (const orderId of orderIds) {
    await syncAppointmentEstimatedWindowPeriodForOrder({ orderId, tx: client })
  }
}

/**
 * 订单提柜日期变更时，刷新该订单下未锁定的预计窗口期（提柜日历日+3；无提柜日则置空）。
 */
export async function syncAppointmentEstimatedWindowPeriodForOrder(args: {
  orderId: bigint
  pickupDate?: Date | null
  tx?: Prisma.TransactionClient
}): Promise<void> {
  const client = args.tx ?? prisma
  let pickupDate = args.pickupDate
  if (pickupDate === undefined) {
    const order = await client.orders.findUnique({
      where: { order_id: args.orderId },
      select: { pickup_date: true },
    })
    pickupDate = order?.pickup_date ?? null
  }

  const computed = pickupDateToEstimatedWindowPeriod(pickupDate)
  const orderDetails = await client.order_detail.findMany({
    where: { order_id: args.orderId },
    select: { id: true },
  })
  if (!orderDetails.length) return

  const lines = await client.appointment_detail_lines.findMany({
    where: {
      order_detail_id: { in: orderDetails.map((od) => od.id) },
      estimated_window_period_locked: false,
    },
    select: {
      id: true,
      estimated_window_period: true,
    },
  })
  if (!lines.length) return

  const computedKey = computed ? dateOnlyPart(computed) : null
  const needsUpdate = lines.filter((line) => {
    const storedKey = line.estimated_window_period
      ? dateOnlyPart(line.estimated_window_period)
      : null
    return storedKey !== computedKey
  })
  if (!needsUpdate.length) return

  await client.appointment_detail_lines.updateMany({
    where: {
      id: { in: needsUpdate.map((l) => l.id) },
    },
    data: {
      estimated_window_period: computed,
      updated_at: new Date(),
    },
  })
}

export async function initialEstimatedWindowPeriodFieldsForOrder(
  orderId: bigint,
  tx?: Prisma.TransactionClient
): Promise<{
  estimated_window_period: Date | null
  estimated_window_period_locked: boolean
}> {
  const client = tx ?? prisma
  const order = await client.orders.findUnique({
    where: { order_id: orderId },
    select: { pickup_date: true },
  })
  return {
    estimated_window_period: pickupDateToEstimatedWindowPeriod(order?.pickup_date ?? null),
    estimated_window_period_locked: false,
  }
}
