/**
 * 订单状态为「已取消」时，从 TMS/WMS/预约等下游业务中移除关联数据；保留 orders 与 order_detail 等订单主数据。
 * 删除顺序遵循外键依赖（先子表、再预约/入库等）。
 */
import type { Prisma } from '@prisma/client'

export async function purgeOperationalDataForCancelledOrder(
  tx: Prisma.TransactionClient,
  orderId: bigint
): Promise<void> {
  await tx.pickup_management.deleteMany({ where: { order_id: orderId } })

  const appointments = await tx.delivery_appointments.findMany({
    where: { order_id: orderId },
    select: { appointment_id: true },
  })
  const appointmentIds = appointments.map((a) => a.appointment_id)
  if (appointmentIds.length > 0) {
    await tx.delivery_management.deleteMany({
      where: { appointment_id: { in: appointmentIds } },
    })
  }

  await tx.inventory_lots.deleteMany({ where: { order_id: orderId } })

  const inbound = await tx.inbound_receipt.findUnique({
    where: { order_id: orderId },
    select: { inbound_receipt_id: true },
  })
  if (inbound) {
    await tx.unload_bill.deleteMany({
      where: { inbound_receipt_id: inbound.inbound_receipt_id },
    })
    await tx.putaway_tasks.deleteMany({
      where: { inbound_receipt_detail_id: inbound.inbound_receipt_id },
    })
    await tx.inbound_receipt.delete({
      where: { order_id: orderId },
    })
  }

  await tx.outbound_shipment_lines.deleteMany({ where: { order_id: orderId } })

  await tx.delivery_appointments.deleteMany({ where: { order_id: orderId } })
}
