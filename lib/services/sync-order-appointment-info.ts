/**
 * 同步订单的预约信息
 * 
 * 功能：
 * 1. 查找订单的所有 order_detail 关联的预约
 * 2. 如果没有预约，将 orders.appointment_time 和 orders.warehouse_account 设为 null
 * 3. 如果有预约，找到时间最早的预约（使用 confirmed_start，如果没有则用 requested_start）
 * 4. 将最早预约的 appointment_account 和 appointment_time 填充到 orders 表
 */

import prisma from '@/lib/prisma'

/**
 * 同步指定订单的预约信息
 * @param orderId 订单ID
 */
export async function syncOrderAppointmentInfo(orderId: bigint): Promise<void> {
  try {
    // 1. 查找该订单的所有 order_detail
    const orderDetails = await prisma.order_detail.findMany({
      where: {
        order_id: orderId,
      },
      select: {
        id: true,
      },
    })

    if (orderDetails.length === 0) {
      // 如果没有订单明细，清空预约信息
      await prisma.orders.update({
        where: { order_id: orderId },
        data: {
          appointment_time: null,
          warehouse_account: null,
        },
      })
      return
    }

    const orderDetailIds = orderDetails.map(od => od.id)

    // 2. 查找这些 order_detail 关联的所有预约（通过 appointment_detail_lines）
    const appointmentDetailLines = await prisma.appointment_detail_lines.findMany({
      where: {
        order_detail_id: {
          in: orderDetailIds,
        },
      },
      include: {
        delivery_appointments: {
          select: {
            appointment_id: true,
            confirmed_start: true,
            requested_start: true,
            appointment_account: true,
            rejected: true,
          },
        },
      },
    })

    // 3. 过滤掉被拒绝的预约，并提取所有有效的预约
    const validAppointments = appointmentDetailLines
      .map(line => line.delivery_appointments)
      .filter(apt => apt && !apt.rejected)

    if (validAppointments.length === 0) {
      // 如果没有有效预约，清空预约信息
      await prisma.orders.update({
        where: { order_id: orderId },
        data: {
          appointment_time: null,
          warehouse_account: null,
        },
      })
      return
    }

    // 4. 找到时间最早的预约
    // 使用 confirmed_start，如果没有则用 requested_start
    let earliestAppointment = validAppointments[0]
    let earliestTime = earliestAppointment.confirmed_start || earliestAppointment.requested_start

    for (const apt of validAppointments) {
      const aptTime = apt.confirmed_start || apt.requested_start
      if (aptTime && earliestTime) {
        if (aptTime < earliestTime) {
          earliestAppointment = apt
          earliestTime = aptTime
        }
      } else if (aptTime && !earliestTime) {
        // 如果当前最早时间为空，但当前预约有时间，则使用当前预约
        earliestAppointment = apt
        earliestTime = aptTime
      }
    }

    // 5. 更新 orders 表
    await prisma.orders.update({
      where: { order_id: orderId },
      data: {
        appointment_time: earliestTime,
        warehouse_account: earliestAppointment.appointment_account || null,
      },
    })
  } catch (error) {
    console.error(`同步订单 ${orderId} 的预约信息失败:`, error)
    throw error
  }
}

/**
 * 批量同步多个订单的预约信息
 * @param orderIds 订单ID数组
 */
export async function syncMultipleOrdersAppointmentInfo(orderIds: bigint[]): Promise<void> {
  for (const orderId of orderIds) {
    try {
      await syncOrderAppointmentInfo(orderId)
    } catch (error) {
      console.error(`同步订单 ${orderId} 的预约信息失败:`, error)
      // 继续处理其他订单，不中断整个流程
    }
  }
}

