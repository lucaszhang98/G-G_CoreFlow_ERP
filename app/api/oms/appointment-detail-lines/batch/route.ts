import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

const MAX_LINES = 50

/**
 * POST - 批量创建预约明细（同一预约）
 * 全部成功或全部回滚，单次最多 50 条
 * Body: { appointment_id: string, lines: [{ order_detail_id: string, estimated_pallets: number }] }
 */
export async function POST(request: NextRequest) {
  let body: any = null
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    body = await request.json()
    const { appointment_id, lines } = body

    if (!appointment_id || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: '缺少必需字段：appointment_id 和 lines（非空数组）' },
        { status: 400 }
      )
    }

    if (lines.length > MAX_LINES) {
      return NextResponse.json(
        { error: `单次最多加入 ${MAX_LINES} 条明细，当前 ${lines.length} 条` },
        { status: 400 }
      )
    }

    const appointmentId = BigInt(appointment_id)
    const createdBy = session.user.id ? BigInt(session.user.id) : null
    const { recalcUnbookedRemainingForOrderDetail } = await import(
      '@/lib/services/recalc-unbooked-remaining.service'
    )

    const effectiveBooked = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)

    const results = await prisma.$transaction(async (tx) => {
      const created: { id: bigint; order_detail_id: bigint }[] = []
      let totalPalletsToAdd = 0

      for (const line of lines) {
        const rawId = line.order_detail_id
        const estimated_pallets = parseInt(line.estimated_pallets, 10) || 0

        if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
          throw new Error('lines 中缺少 order_detail_id，请刷新订单明细页后重新勾选再试')
        }

        let orderDetailId: bigint
        try {
          orderDetailId = BigInt(rawId)
        } catch {
          throw new Error(`无效的订单明细 ID: ${rawId}，请刷新页面后重新勾选`)
        }

        const existing = await tx.appointment_detail_lines.findFirst({
          where: {
            appointment_id: appointmentId,
            order_detail_id: orderDetailId,
          },
        })
        if (existing) {
          throw new Error(`该预约中已存在订单明细 ${order_detail_id}，请勿重复添加`)
        }

        const inventoryLot = await tx.inventory_lots.findFirst({
          where: { order_detail_id: orderDetailId },
          select: {
            inventory_lot_id: true,
            unbooked_pallet_count: true,
            pallet_count: true,
          },
        })

        const existingAppointmentLines = await tx.appointment_detail_lines.findMany({
          where: { order_detail_id: orderDetailId },
          select: {
            estimated_pallets: true,
            rejected_pallets: true,
          } as { estimated_pallets: true; rejected_pallets: true },
        })
        const totalEffectiveBooked = existingAppointmentLines.reduce(
          (sum, l) =>
            sum + effectiveBooked(l.estimated_pallets, (l as { rejected_pallets?: number | null }).rejected_pallets),
          0
        )

        let totalPalletsAtTime: number
        if (inventoryLot && inventoryLot.pallet_count > 0) {
          totalPalletsAtTime = inventoryLot.pallet_count - totalEffectiveBooked
        } else {
          const orderDetail = await tx.order_detail.findUnique({
            where: { id: orderDetailId },
            select: { estimated_pallets: true },
          })
          const est = orderDetail?.estimated_pallets ?? 0
          totalPalletsAtTime = est - totalEffectiveBooked
        }

        if (estimated_pallets > totalPalletsAtTime) {
          throw new Error(
            `订单明细 ${order_detail_id} 预计板数（${estimated_pallets}）不能超过总板数（${totalPalletsAtTime}）`
          )
        }

        const row = await tx.appointment_detail_lines.create({
          data: {
            appointment_id: appointmentId,
            order_detail_id: orderDetailId,
            estimated_pallets: estimated_pallets,
            rejected_pallets: 0,
            total_pallets_at_time: totalPalletsAtTime,
            created_by: createdBy,
            updated_by: createdBy,
          } as import('@prisma/client').Prisma.appointment_detail_linesUncheckedCreateInput,
        })

        created.push({ id: row.id, order_detail_id: orderDetailId })
        totalPalletsToAdd += estimated_pallets

        await recalcUnbookedRemainingForOrderDetail(orderDetailId, tx)
      }

      const appointment = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { total_pallets: true },
      })
      if (appointment) {
        await tx.delivery_appointments.update({
          where: { appointment_id: appointmentId },
          data: { total_pallets: (appointment.total_pallets || 0) + totalPalletsToAdd },
        })
      }

      return created
    })

    const orderDetailIds = results.map((r) => r.order_detail_id)
    const orderDetails = await prisma.order_detail.findMany({
      where: { id: { in: orderDetailIds } },
      select: { order_id: true },
    })
    const orderIds = [...new Set(orderDetails.map((o) => o.order_id).filter(Boolean))] as bigint[]

    try {
      const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
      for (const orderId of orderIds) {
        await syncOrderAppointmentInfo(orderId)
      }
    } catch (syncError: any) {
      console.warn('同步订单预约信息失败:', syncError)
    }

    return NextResponse.json(
      {
        success: true,
        data: { created: results.length, ids: results.map((r) => serializeBigInt(r.id)) },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('批量创建预约明细失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '批量加入预约失败',
      },
      { status: 400 }
    )
  }
}
