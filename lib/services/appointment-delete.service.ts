/**
 * 预约删除（软删除）：不再物理删除主表与明细，仅将 enabled 置为 false，
 * 并删除送仓管理 / 出库单等与原先硬删一致的清理，再重算未约/剩余板数。
 */

import prisma from '@/lib/prisma'
import { recalcUnbookedRemainingForOrderDetails } from './recalc-unbooked-remaining.service'

export class AppointmentDeleteService {
  /**
   * 停用单个预约（保留明细与主表记录；板数通过重算回退）
   * @returns skipped 为 true 表示记录已是停用状态，未再次写库
   */
  static async deleteAppointment(appointmentId: bigint): Promise<{ skipped: boolean }> {
    const orderIdsToSync = new Set<bigint>()
    let skipped = false

    await prisma.$transaction(async (tx) => {
      const existing = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { order_id: true, enabled: true },
      })
      if (!existing) {
        throw new Error('预约不存在')
      }
      if (existing.enabled === false) {
        console.log(`[预约删除] 预约 ${appointmentId} 已停用，跳过`)
        skipped = true
        return
      }

      const appointmentDetails = await tx.appointment_detail_lines.findMany({
        where: { appointment_id: appointmentId },
        select: {
          order_detail_id: true,
          order_detail: { select: { order_id: true } },
        },
      })

      console.log(`[预约删除] 预约 ${appointmentId} 包含 ${appointmentDetails.length} 个明细（软删除保留明细）`)

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

      await tx.delivery_appointments.update({
        where: { appointment_id: appointmentId },
        data: {
          enabled: false,
          total_pallets: 0,
          updated_at: new Date(),
        },
      })

      await recalcUnbookedRemainingForOrderDetails(orderDetailIds, tx)

      if (existing.order_id) orderIdsToSync.add(existing.order_id)
      console.log(`[预约删除] 已停用预约主表：${appointmentId}`)
    })

    if (skipped) {
      return { skipped: true }
    }

    if (orderIdsToSync.size > 0) {
      try {
        const { syncMultipleOrdersAppointmentInfo } = await import('./sync-order-appointment-info')
        await syncMultipleOrdersAppointmentInfo(Array.from(orderIdsToSync))
        console.log(`[预约删除] ✅ 已同步 ${orderIdsToSync.size} 个订单的预约信息`)
      } catch (syncError: any) {
        console.warn('[预约删除] 同步订单预约信息失败:', syncError)
      }
    }

    console.log(`[预约删除] ✅ 预约 ${appointmentId} 已停用，板数已按重算回退`)
    return { skipped: false }
  }

  /**
   * 批量停用预约
   */
  static async deleteAppointments(appointmentIds: bigint[]): Promise<{ count: number }> {
    let count = 0

    for (const appointmentId of appointmentIds) {
      try {
        const { skipped } = await this.deleteAppointment(appointmentId)
        if (!skipped) count++
      } catch (error: any) {
        console.error(`[批量删除] 停用预约 ${appointmentId} 失败:`, error.message)
      }
    }

    console.log(`[批量删除] ✅ 成功停用 ${count}/${appointmentIds.length} 个预约`)
    return { count }
  }
}
