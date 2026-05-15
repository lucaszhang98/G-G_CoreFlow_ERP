/**
 * 订单「操作方式」变更时：只取消**本订单明细**在预约上的占用（删除对应 appointment_detail_lines），
 * 不重伤拼柜里他单明细；删完后若该预约已无任何明细行，再整单停用（AppointmentDeleteService）。
 * 若预约主表 order_id 仍指向本单但明细已不含本单，则将 order_id 改到剩余明细所在订单。
 */

import prisma from '@/lib/prisma'
import { AppointmentDeleteService } from './appointment-delete.service'
import { recalcUnbookedRemainingForOrderDetails } from './recalc-unbooked-remaining.service'

const appointmentNotDisabled = { NOT: { enabled: false } } as const

export type CancelOrderAppointmentAssociationResult = {
  /** 删除的预约明细行数（仅本单 order_detail） */
  detailLinesRemoved: number
  /** 删行后已无任何明细、从而整单停用的预约数 */
  appointmentsFullyDisabled: number
}

/**
 * 移除本订单全部明细在仍生效预约上的关联行，并按需停用空预约。
 */
export async function cancelAllActiveAppointmentsForOrder(
  orderId: bigint
): Promise<CancelOrderAppointmentAssociationResult> {
  const orderDetails = await prisma.order_detail.findMany({
    where: { order_id: orderId },
    select: { id: true },
  })
  const orderDetailIds = orderDetails.map((d) => d.id)
  if (orderDetailIds.length === 0) {
    return { detailLinesRemoved: 0, appointmentsFullyDisabled: 0 }
  }

  const linesToRemove = await prisma.appointment_detail_lines.findMany({
    where: {
      order_detail_id: { in: orderDetailIds },
      delivery_appointments: { is: appointmentNotDisabled },
    },
    select: { id: true, appointment_id: true },
  })

  const appointmentIdsTouched = [
    ...new Set(linesToRemove.map((l) => l.appointment_id.toString())),
  ].map((s) => BigInt(s))

  await prisma.$transaction(async (tx) => {
    if (linesToRemove.length > 0) {
      await tx.appointment_detail_lines.deleteMany({
        where: { order_detail_id: { in: orderDetailIds } },
      })
      await recalcUnbookedRemainingForOrderDetails(orderDetailIds, tx)
    }

    for (const apptId of appointmentIdsTouched) {
      const remaining = await tx.appointment_detail_lines.findMany({
        where: { appointment_id: apptId },
        select: { estimated_pallets: true },
      })
      const sum = remaining.reduce((s, r) => s + (r.estimated_pallets || 0), 0)
      await tx.delivery_appointments.update({
        where: { appointment_id: apptId },
        data: { total_pallets: sum, updated_at: new Date() },
      })
    }
  })

  let appointmentsFullyDisabled = 0

  for (const apptId of appointmentIdsTouched) {
    const cnt = await prisma.appointment_detail_lines.count({
      where: { appointment_id: apptId },
    })
    if (cnt === 0) {
      const { skipped } = await AppointmentDeleteService.deleteAppointment(apptId)
      if (!skipped) appointmentsFullyDisabled++
    }
  }

  const headerStillOurs = await prisma.delivery_appointments.findMany({
    where: {
      order_id: orderId,
      ...appointmentNotDisabled,
    },
    select: { appointment_id: true },
  })

  for (const { appointment_id: apptId } of headerStillOurs) {
    const remainingCnt = await prisma.appointment_detail_lines.count({
      where: { appointment_id: apptId },
    })
    if (remainingCnt === 0) {
      const { skipped } = await AppointmentDeleteService.deleteAppointment(apptId)
      if (!skipped) appointmentsFullyDisabled++
      continue
    }
    const first = await prisma.appointment_detail_lines.findFirst({
      where: { appointment_id: apptId },
      select: { order_detail: { select: { order_id: true } } },
    })
    const newOrderId = first?.order_detail?.order_id ?? null
    if (newOrderId != null && newOrderId !== orderId) {
      await prisma.delivery_appointments.update({
        where: { appointment_id: apptId },
        data: { order_id: newOrderId, updated_at: new Date() },
      })
    }
  }

  const affectedApptIds = new Set<string>()
  for (const id of appointmentIdsTouched) affectedApptIds.add(id.toString())
  for (const h of headerStillOurs) affectedApptIds.add(h.appointment_id.toString())

  const orderIdsToSync = new Set<bigint>([orderId])
  for (const idStr of affectedApptIds) {
    const apptId = BigInt(idStr)
    const lines = await prisma.appointment_detail_lines.findMany({
      where: { appointment_id: apptId },
      select: { order_detail: { select: { order_id: true } } },
    })
    for (const l of lines) {
      if (l.order_detail?.order_id) orderIdsToSync.add(l.order_detail.order_id)
    }
  }

  try {
    const { syncMultipleOrdersAppointmentInfo } = await import('./sync-order-appointment-info')
    await syncMultipleOrdersAppointmentInfo(Array.from(orderIdsToSync))
  } catch (e) {
    console.warn('[cancel-appointments-for-order] 同步订单预约信息失败:', e)
  }

  try {
    const { scheduleStorageInvoiceSync } = await import('@/lib/finance/storage-invoice-sync')
    for (const oid of orderIdsToSync) {
      scheduleStorageInvoiceSync(oid, null)
    }
  } catch (e) {
    console.warn('[cancel-appointments-for-order] 仓储账单同步调度失败', e)
  }

  return {
    detailLinesRemoved: linesToRemove.length,
    appointmentsFullyDisabled,
  }
}
