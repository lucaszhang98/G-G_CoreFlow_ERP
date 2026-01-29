/**
 * 预约删除Service
 *
 * 删除预约后，对受影响的 order_detail 重算未约板数/剩余板数（含拒收板数公式）。
 */

import prisma from '@/lib/prisma'
import { recalcUnbookedRemainingForOrderDetails } from './recalc-unbooked-remaining.service'

export class AppointmentDeleteService {
  /**
   * 删除单个预约（删除明细后对受影响订单明细重算未约/剩余板数）
   */
  static async deleteAppointment(appointmentId: bigint): Promise<void> {
    const orderIdsToSync = new Set<bigint>()

    await prisma.$transaction(async (tx) => {
      const appointmentDetails = await tx.appointment_detail_lines.findMany({
        where: { appointment_id: appointmentId },
        select: {
          order_detail_id: true,
          order_detail: { select: { order_id: true } },
        },
      })

      console.log(`[预约删除] 预约 ${appointmentId} 包含 ${appointmentDetails.length} 个明细`)

      for (const d of appointmentDetails) {
        if (d.order_detail?.order_id) orderIdsToSync.add(d.order_detail.order_id)
      }

      const orderDetailIds = [...new Set(appointmentDetails.map((d) => d.order_detail_id))]

      const existingDelivery = await tx.delivery_management.findUnique({
        where: { appointment_id: appointmentId },
        select: { delivery_id: true },
      })
      if (existingDelivery) {
        await tx.delivery_management.delete({ where: { delivery_id: existingDelivery.delivery_id } })
      }
      await tx.$executeRaw`
        DELETE FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId}
      `
      await tx.appointment_detail_lines.deleteMany({
        where: { appointment_id: appointmentId },
      })

      await recalcUnbookedRemainingForOrderDetails(orderDetailIds, tx)

      const appointment = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { order_id: true },
      })
      if (appointment?.order_id) orderIdsToSync.add(appointment.order_id)
      await tx.delivery_appointments.delete({
        where: { appointment_id: appointmentId },
      })
      console.log(`[预约删除] 删除预约主表：${appointmentId}`)
    })

    // 在事务外同步订单预约信息
    if (orderIdsToSync.size > 0) {
      try {
        const { syncMultipleOrdersAppointmentInfo } = await import('./sync-order-appointment-info')
        await syncMultipleOrdersAppointmentInfo(Array.from(orderIdsToSync))
        console.log(`[预约删除] ✅ 已同步 ${orderIdsToSync.size} 个订单的预约信息`)
      } catch (syncError: any) {
        console.warn('[预约删除] 同步订单预约信息失败:', syncError)
        // 不影响删除流程
      }
    }

    console.log(`[预约删除] ✅ 预约 ${appointmentId} 删除完成，所有板数已回退`)
  }

  /**
   * 批量删除预约（包含板数回退）
   */
  static async deleteAppointments(appointmentIds: bigint[]): Promise<{ count: number }> {
    let count = 0

    // 逐个删除（确保每个预约的事务独立）
    for (const appointmentId of appointmentIds) {
      try {
        await this.deleteAppointment(appointmentId)
        count++
      } catch (error: any) {
        console.error(`[批量删除] 删除预约 ${appointmentId} 失败:`, error.message)
        // 继续删除其他预约
      }
    }

    console.log(`[批量删除] ✅ 成功删除 ${count}/${appointmentIds.length} 个预约`)
    return { count }
  }
}








