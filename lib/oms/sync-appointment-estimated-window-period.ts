import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { pickupDateToEstimatedWindowPeriod } from '@/lib/oms/estimated-window-period'

/**
 * 订单提柜日期变更时，刷新该订单下未锁定的人工预计窗口期。
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

  await client.appointment_detail_lines.updateMany({
    where: {
      order_detail_id: { in: orderDetails.map((od) => od.id) },
      estimated_window_period_locked: false,
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
