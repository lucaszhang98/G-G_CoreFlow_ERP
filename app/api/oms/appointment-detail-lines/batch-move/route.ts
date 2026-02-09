/**
 * 批量将预约明细转到其他预约
 * POST body: { lineIds: string[], targetReferenceNumber: string }
 * 通过目标预约的预约号码（reference_number）查找目标预约，将选中明细的 appointment_id 更新为目标预约
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { lineIds, targetReferenceNumber } = body

    if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
      return NextResponse.json({ error: '请提供要转移的明细ID列表（lineIds）' }, { status: 400 })
    }

    const ref = typeof targetReferenceNumber === 'string' ? targetReferenceNumber.trim() : ''
    if (!ref) {
      return NextResponse.json({ error: '请输入目标预约号码' }, { status: 400 })
    }

    const targetAppointment = await prisma.delivery_appointments.findFirst({
      where: { reference_number: ref },
      select: { appointment_id: true, total_pallets: true },
    })

    if (!targetAppointment) {
      return NextResponse.json({ error: `未找到预约号码为「${ref}」的预约` }, { status: 404 })
    }

    const targetId = targetAppointment.appointment_id
    const bigIntLineIds = lineIds.map((id: string) => BigInt(id))

    const lines = await prisma.appointment_detail_lines.findMany({
      where: { id: { in: bigIntLineIds } },
      select: {
        id: true,
        appointment_id: true,
        order_detail_id: true,
        estimated_pallets: true,
        rejected_pallets: true,
      },
    })

    if (lines.length === 0) {
      return NextResponse.json({ error: '未找到要转移的明细' }, { status: 404 })
    }

    const sourceAppointmentId = lines[0].appointment_id
    const allSameSource = lines.every((l) => l.appointment_id === sourceAppointmentId)
    if (!allSameSource) {
      return NextResponse.json({ error: '选中的明细必须属于同一预约' }, { status: 400 })
    }

    if (sourceAppointmentId === targetId) {
      return NextResponse.json({ error: '目标预约与当前预约相同，无需转移' }, { status: 400 })
    }

    // total_pallets 与创建/删除一致：按 estimated_pallets 累加
    const totalPalletsToMove = lines.reduce((sum, l) => sum + (l.estimated_pallets ?? 0), 0)

    const { recalcUnbookedRemainingForOrderDetail } = await import(
      '@/lib/services/recalc-unbooked-remaining.service'
    )

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const existingInTarget = await tx.appointment_detail_lines.findUnique({
          where: {
            appointment_id_order_detail_id: {
              appointment_id: targetId,
              order_detail_id: line.order_detail_id,
            },
          },
        })
        if (existingInTarget) {
          throw new Error(
            `目标预约中已存在仓点明细（order_detail_id: ${line.order_detail_id}），无法转入，请先处理重复`
          )
        }

        await tx.appointment_detail_lines.update({
          where: { id: line.id },
          data: {
            appointment_id: targetId,
            updated_by: session.user?.id ? BigInt(session.user.id) : null,
            updated_at: new Date(),
          },
        })
        await recalcUnbookedRemainingForOrderDetail(line.order_detail_id, tx)
      }

      const [sourceAppointment, targetAppointmentInTx] = await Promise.all([
        tx.delivery_appointments.findUnique({
          where: { appointment_id: sourceAppointmentId },
          select: { total_pallets: true },
        }),
        tx.delivery_appointments.findUnique({
          where: { appointment_id: targetId },
          select: { total_pallets: true },
        }),
      ])

      if (sourceAppointment) {
        await tx.delivery_appointments.update({
          where: { appointment_id: sourceAppointmentId },
          data: {
            total_pallets: Math.max(0, (sourceAppointment.total_pallets || 0) - totalPalletsToMove),
          },
        })
      }
      if (targetAppointmentInTx) {
        await tx.delivery_appointments.update({
          where: { appointment_id: targetId },
          data: {
            total_pallets: (targetAppointmentInTx.total_pallets || 0) + totalPalletsToMove,
          },
        })
      }
    })

    const orderDetailIds = [...new Set(lines.map((l) => l.order_detail_id))]
    try {
      const orderDetails = await prisma.order_detail.findMany({
        where: { id: { in: orderDetailIds } },
        select: { order_id: true },
      })
      const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
      for (const od of orderDetails) {
        if (od.order_id) await syncOrderAppointmentInfo(od.order_id)
      }
    } catch (syncError: any) {
      console.warn('同步订单预约信息失败:', syncError)
    }

    return NextResponse.json({
      success: true,
      message: `已成功将 ${lines.length} 条明细转到预约「${ref}」`,
      moved: lines.length,
    })
  } catch (error: any) {
    console.error('批量转移预约明细失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '批量转移预约明细失败' },
      { status: 500 }
    )
  }
}
