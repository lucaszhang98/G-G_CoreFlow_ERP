import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// PUT - 更新预约明细
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = params instanceof Promise ? await params : params
  let body: any = null
  
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    body = await request.json()
    const { estimated_pallets, rejected_pallets } = body

    // 获取当前预约明细（含 rejected_pallets）
    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: {
        appointment_id: true,
        order_detail_id: true,
        estimated_pallets: true,
        rejected_pallets: true,
      } as { appointment_id: true; order_detail_id: true; estimated_pallets: true; rejected_pallets: true },
    })

    if (!currentLine) {
      return NextResponse.json({ success: false, error: '预约明细不存在' }, { status: 404 })
    }

    const lineWithRej = currentLine as { estimated_pallets: number | null; rejected_pallets?: number | null }
    const orderDetailId = currentLine.order_detail_id
    const appointmentId = currentLine.appointment_id
    const oldEstimated = currentLine.estimated_pallets ?? 0
    const oldRejected = lineWithRej.rejected_pallets ?? 0
    const effective = (est: number, rej?: number | null) => est - (rej ?? 0)
    const oldEffective = effective(oldEstimated, oldRejected)

    let newEstimated: number | undefined = estimated_pallets !== undefined ? parseInt(estimated_pallets) || 0 : oldEstimated
    let newRejected: number | undefined = rejected_pallets !== undefined ? Math.max(0, parseInt(rejected_pallets) || 0) : oldRejected
    if (newRejected! > newEstimated!) {
      return NextResponse.json({ error: '拒收板数不能大于预计板数' }, { status: 400 })
    }
    const newEffective = effective(newEstimated, newRejected)

    // 校验：新预计板数不能超过当前可约总板数（当前未约 + 本行旧有效占用）
    const inventoryLot = await prisma.inventory_lots.findFirst({
      where: { order_detail_id: orderDetailId },
      select: { inventory_lot_id: true, pallet_count: true, unbooked_pallet_count: true },
    })
    const allLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { id: true, estimated_pallets: true, rejected_pallets: true } as { id: true; estimated_pallets: true; rejected_pallets: true },
    })
    const totalEffectiveExcludingThis = allLines
      .filter((l) => l.id !== BigInt(resolvedParams.id))
      .reduce((sum: number, l: any) => sum + effective(l.estimated_pallets, l.rejected_pallets), 0)
    let maxAllowed: number
    if (inventoryLot && inventoryLot.pallet_count > 0) {
      maxAllowed = inventoryLot.pallet_count - totalEffectiveExcludingThis
    } else {
      const od = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { estimated_pallets: true },
      })
      maxAllowed = (od?.estimated_pallets ?? 0) - totalEffectiveExcludingThis
    }
    if (newEstimated! > maxAllowed) {
      return NextResponse.json({ error: `预计板数（${newEstimated}）不能超过总板数（${maxAllowed}）` }, { status: 400 })
    }

    const totalPalletsAtTime = maxAllowed
    const { recalcUnbookedRemainingForOrderDetail } = await import('@/lib/services/recalc-unbooked-remaining.service')

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        updated_by: session.user.id ? BigInt(session.user.id) : null,
        updated_at: new Date(),
      }
      if (estimated_pallets !== undefined) updateData.estimated_pallets = newEstimated
      if (rejected_pallets !== undefined) updateData.rejected_pallets = newRejected
      if (estimated_pallets !== undefined) updateData.total_pallets_at_time = totalPalletsAtTime

      const appointmentDetailLine = await tx.appointment_detail_lines.update({
        where: { id: BigInt(resolvedParams.id) },
        data: updateData,
      })

      await recalcUnbookedRemainingForOrderDetail(orderDetailId, tx)

      // total_pallets 展示用：按预计板数累加
      const palletsDiff = (newEstimated ?? oldEstimated) - oldEstimated
      if (palletsDiff !== 0) {
        const appointment = await tx.delivery_appointments.findUnique({
          where: { appointment_id: appointmentId },
          select: { total_pallets: true },
        })
        if (appointment) {
          await tx.delivery_appointments.update({
            where: { appointment_id: appointmentId },
            data: { total_pallets: Math.max(0, (appointment.total_pallets || 0) + palletsDiff) },
          })
        }
      }

      return appointmentDetailLine
    })

    // 同步订单的预约信息
    try {
      const orderDetail = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { order_id: true },
      })
      if (orderDetail?.order_id) {
        const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
        await syncOrderAppointmentInfo(orderDetail.order_id)
      }
    } catch (syncError: any) {
      console.warn('同步订单预约信息失败:', syncError)
      // 不影响预约明细更新，只记录警告
    }

    return NextResponse.json({
      success: true,
      data: serializeBigInt(result)
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }
    console.error('更新预约明细失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
      body: body,
      id: resolvedParams.id,
    })
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '更新预约明细失败' 
      },
      { status: 500 }
    )
  }
}

// DELETE - 删除预约明细（删除后重算未约/剩余板数）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = params instanceof Promise ? await params : params
  
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { appointment_id: true, order_detail_id: true, estimated_pallets: true },
    })

    if (!currentLine) {
      return NextResponse.json({ success: false, error: '预约明细不存在' }, { status: 404 })
    }

    const orderDetailId = currentLine.order_detail_id
    const appointmentId = currentLine.appointment_id
    const estimatedPalletsToRevert = currentLine.estimated_pallets ?? 0

    const { recalcUnbookedRemainingForOrderDetail } = await import('@/lib/services/recalc-unbooked-remaining.service')

    await prisma.$transaction(async (tx) => {
      await tx.appointment_detail_lines.delete({
        where: { id: BigInt(resolvedParams.id) },
      })
      await recalcUnbookedRemainingForOrderDetail(orderDetailId, tx)
      const appointment = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { total_pallets: true },
      })
      if (appointment) {
        await tx.delivery_appointments.update({
          where: { appointment_id: appointmentId },
          data: { total_pallets: Math.max(0, (appointment.total_pallets || 0) - estimatedPalletsToRevert) },
        })
      }
    })

    // 同步订单的预约信息
    try {
      const orderDetail = await prisma.order_detail.findUnique({
        where: { id: orderDetailId },
        select: { order_id: true },
      })
      if (orderDetail?.order_id) {
        const { syncOrderAppointmentInfo } = await import('@/lib/services/sync-order-appointment-info')
        await syncOrderAppointmentInfo(orderDetail.order_id)
      }
    } catch (syncError: any) {
      console.warn('同步订单预约信息失败:', syncError)
      // 不影响预约明细删除，只记录警告
    }

    return NextResponse.json({ 
      success: true,
      message: '预约明细删除成功' 
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }
    console.error('删除预约明细失败:', error)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
      id: resolvedParams.id,
    })
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '删除预约明细失败' 
      },
      { status: 500 }
    )
  }
}
