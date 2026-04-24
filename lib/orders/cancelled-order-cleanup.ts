/**
 * 订单状态为「已取消」时，从 TMS/WMS/预约等下游业务中移除关联数据；保留 orders 与 order_detail 等订单主数据。
 * 删除顺序遵循外键依赖（先子表、再预约/入库等）。
 */
import type { Prisma } from '@prisma/client'

export async function purgeOperationalDataForCancelledOrder(
  tx: Prisma.TransactionClient,
  orderId: bigint
): Promise<void> {
  const orderDetails = await tx.order_detail.findMany({
    where: { order_id: orderId },
    select: { id: true },
  })
  const orderDetailIds = orderDetails.map((d) => d.id)

  await tx.pickup_management.deleteMany({ where: { order_id: orderId } })

  const ownedAppointments = await tx.delivery_appointments.findMany({
    where: { order_id: orderId },
    select: { appointment_id: true },
  })
  const ownedAppointmentIds = ownedAppointments.map((a) => a.appointment_id)

  const crossOrderAppointmentIds =
    orderDetailIds.length > 0
      ? (
          await tx.appointment_detail_lines.findMany({
            where: { order_detail_id: { in: orderDetailIds } },
            select: { appointment_id: true },
            distinct: ['appointment_id'],
          })
        ).map((r) => r.appointment_id)
      : []

  const affectedAppointmentIds = [
    ...new Set([...ownedAppointmentIds, ...crossOrderAppointmentIds]),
  ]

  if (orderDetailIds.length > 0) {
    // 从所有预约中移除本订单明细（包括跨订单拼到同一预约的情况）
    await tx.appointment_detail_lines.deleteMany({
      where: { order_detail_id: { in: orderDetailIds } },
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
  await tx.invoices.deleteMany({ where: { order_id: orderId } })

  /** 预约主表不物理删除：清理送仓/出库并停用（与预约管理「删除」一致） */
  const softDisableAppointmentsByIds = async (ids: bigint[]) => {
    const unique = [...new Set(ids.map((x) => x.toString()))].map((s) => BigInt(s))
    if (unique.length === 0) return
    await tx.delivery_management.deleteMany({
      where: { appointment_id: { in: unique } },
    })
    for (const appointmentId of unique) {
      await tx.$executeRaw`
        DELETE FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId}
      `
    }
    await tx.delivery_appointments.updateMany({
      where: { appointment_id: { in: unique } },
      data: {
        enabled: false,
        total_pallets: 0,
        updated_at: new Date(),
      },
    })
  }

  // 仅对删除本单明细后已无明细行的预约做停用（与原先「删空预约」语义一致，避免误停仍含他单明细的预约）
  if (affectedAppointmentIds.length > 0) {
    const maybeEmptyAppointments = await tx.delivery_appointments.findMany({
      where: { appointment_id: { in: affectedAppointmentIds } },
      select: {
        appointment_id: true,
        _count: { select: { appointment_detail_lines: true } },
      },
    })
    const emptyAppointmentIds = maybeEmptyAppointments
      .filter((a) => a._count.appointment_detail_lines === 0)
      .map((a) => a.appointment_id)

    if (emptyAppointmentIds.length > 0) {
      await softDisableAppointmentsByIds(emptyAppointmentIds)
    }
  }
}
