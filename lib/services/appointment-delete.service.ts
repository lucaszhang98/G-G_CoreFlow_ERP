/**
 * 预约删除（软删除）：不物理删除 delivery_appointments，也不删除 appointment_detail_lines（保留可查），
 * 仅将 enabled 置为 false；删除送仓管理 / 出库单；再重算未约/剩余板数（重算逻辑忽略已停用预约上的明细）。
 */

import prisma from '@/lib/prisma'
import { recalcUnbookedRemainingForOrderDetails } from './recalc-unbooked-remaining.service'

export class AppointmentDeleteService {
  /**
   * 停用单个预约（保留主表与全部明细行供查看；板数通过重算回退）
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

      console.log(
        `[预约删除] 预约 ${appointmentId} 停用：保留 ${appointmentDetails.length} 条明细行（仅不再计入未约等）`
      )

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
          updated_at: new Date(),
        },
      })

      await recalcUnbookedRemainingForOrderDetails(orderDetailIds, tx)

      if (existing.order_id) orderIdsToSync.add(existing.order_id)
      console.log(`[预约删除] 已停用预约：${appointmentId}`)
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
      try {
        const { scheduleStorageInvoiceSync } = await import('@/lib/finance/storage-invoice-sync')
        for (const oid of orderIdsToSync) {
          scheduleStorageInvoiceSync(oid, null)
        }
      } catch (e) {
        console.warn('[预约删除] 仓储账单同步调度失败', e)
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
