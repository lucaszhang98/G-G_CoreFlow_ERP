/**
 * 预约删除Service
 * 
 * 职责：
 * 1. 删除预约时自动回退板数
 * 2. 区分已入库/未入库，回退到不同的字段
 * 3. 清理关联记录（delivery_management, outbound_shipments）
 */

import prisma from '@/lib/prisma'

export class AppointmentDeleteService {
  /**
   * 删除单个预约（包含板数回退）
   */
  static async deleteAppointment(appointmentId: bigint): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. 查询预约明细（获取所有需要回退的板数）
      const appointmentDetails = await tx.appointment_detail_lines.findMany({
        where: { appointment_id: appointmentId },
        select: {
          id: true,
          order_detail_id: true,
          estimated_pallets: true,
        },
      })

      console.log(`[预约删除] 预约 ${appointmentId} 包含 ${appointmentDetails.length} 个明细`)

      // 2. 对每个明细，回退板数
      for (const detail of appointmentDetails) {
        const palletCount = detail.estimated_pallets || 0

        if (palletCount === 0) {
          console.log(`[预约删除] 明细 ${detail.id} 的板数为0，跳过回退`)
          continue
        }

        // 2.1 查询订单明细信息
        const orderDetail = await tx.order_detail.findUnique({
          where: { id: detail.order_detail_id },
          select: {
            id: true,
            order_id: true,
            delivery_location: true,
            delivery_nature: true,
            remaining_pallets: true,
            estimated_pallets: true,
          },
        })

        if (!orderDetail) {
          console.warn(`[预约删除] 订单明细 ${detail.order_detail_id} 不存在，跳过`)
          continue
        }

        console.log(`[预约删除] 处理订单明细 ${orderDetail.id}，回退 ${palletCount} 板`)

        // 2.2 判断是否已入库（查询 inventory_lots）
        // 通过 order_detail_id 直接查询
        const inventory = await tx.inventory_lots.findFirst({
          where: {
            order_detail_id: orderDetail.id,
          },
          select: {
            inventory_lot_id: true,
            unbooked_pallet_count: true,
            pallet_count: true,
          },
        })

        if (inventory) {
          // 已入库：回退 inventory_lots.unbooked_pallet_count
          await tx.inventory_lots.update({
            where: { inventory_lot_id: inventory.inventory_lot_id },
            data: {
              unbooked_pallet_count: {
                increment: palletCount,
              },
            },
          })
          console.log(
            `[预约删除] ✅ 已入库，回退库存：inventory_lot_id=${inventory.inventory_lot_id}，增加 unbooked_pallet_count +${palletCount}`
          )
        } else {
          // 未入库：回退 order_detail.remaining_pallets
          await tx.order_detail.update({
            where: { id: orderDetail.id },
            data: {
              remaining_pallets: {
                increment: palletCount,
              },
            },
          })
          console.log(
            `[预约删除] ✅ 未入库，回退订单明细：order_detail_id=${orderDetail.id}，增加 remaining_pallets +${palletCount}`
          )
        }
      }

      // 3. 删除关联记录
      // 3.1 删除 delivery_management
      const existingDelivery = await tx.delivery_management.findUnique({
        where: { appointment_id: appointmentId },
        select: { delivery_id: true },
      })

      if (existingDelivery) {
        await tx.delivery_management.delete({
          where: { delivery_id: existingDelivery.delivery_id },
        })
        console.log(`[预约删除] 删除 delivery_management 记录：${existingDelivery.delivery_id}`)
      }

      // 3.2 删除 outbound_shipments（使用原始SQL，避免类型问题）
      await tx.$executeRaw`
        DELETE FROM wms.outbound_shipments WHERE appointment_id = ${appointmentId}
      `
      console.log(`[预约删除] 删除 outbound_shipments 记录`)

      // 4. 删除预约明细
      await tx.appointment_detail_lines.deleteMany({
        where: { appointment_id: appointmentId },
      })
      console.log(`[预约删除] 删除 ${appointmentDetails.length} 条预约明细`)

      // 5. 删除预约主表
      await tx.delivery_appointments.delete({
        where: { appointment_id: appointmentId },
      })
      console.log(`[预约删除] 删除预约主表：${appointmentId}`)
    })

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




