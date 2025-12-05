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
    const { estimated_pallets } = body
    // PO 不再从请求中获取，应该从 order_detail.po 读取

    // 获取当前预约明细
    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { 
        appointment_id: true,
        order_detail_id: true,
        estimated_pallets: true, // 旧值
      },
    })

    if (!currentLine) {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }

    const orderDetailId = currentLine.order_detail_id
    const appointmentId = currentLine.appointment_id
    const oldEstimatedPallets = currentLine.estimated_pallets

    // 如果修改了 estimated_pallets，需要计算差值
    let estimatedPalletsValue: number | undefined
    let palletsDiff = 0
    if (estimated_pallets !== undefined) {
      estimatedPalletsValue = parseInt(estimated_pallets) || 0
      palletsDiff = estimatedPalletsValue - oldEstimatedPallets
    }

    // 检查是否已入库（查询 inventory_lots）
    const inventoryLot = await prisma.inventory_lots.findFirst({
      where: {
        order_detail_id: orderDetailId,
      },
      select: {
        inventory_lot_id: true,
        unbooked_pallet_count: true,
        pallet_count: true,
      },
    })

    // 如果修改了预计板数，需要验证和计算总板数快照
    let totalPalletsAtTime: number | undefined
    if (estimated_pallets !== undefined) {
      if (inventoryLot && inventoryLot.pallet_count > 0) {
        // 已入库：使用未约板数
        totalPalletsAtTime = inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count ?? 0
      } else {
        // 未入库：使用 order_detail 的剩余板数
        const orderDetail = await prisma.order_detail.findUnique({
          where: { id: orderDetailId },
          select: { remaining_pallets: true, estimated_pallets: true },
        })
        totalPalletsAtTime = orderDetail?.remaining_pallets ?? orderDetail?.estimated_pallets ?? 0
      }

      // 验证新值不能超过总板数（需要考虑差值）
      const maxAllowed = totalPalletsAtTime + oldEstimatedPallets // 当前剩余 + 旧值
      if (estimatedPalletsValue !== undefined && estimatedPalletsValue > maxAllowed) {
        return NextResponse.json({ 
          error: `预计板数（${estimatedPalletsValue}）不能超过总板数（${maxAllowed}）` 
        }, { status: 400 })
      }
    }

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        updated_by: session.user.id ? BigInt(session.user.id) : null,
        updated_at: new Date(),
      }

      if (estimated_pallets !== undefined) {
        updateData.estimated_pallets = estimatedPalletsValue
        updateData.total_pallets_at_time = totalPalletsAtTime // 更新总板数快照
      }

      // PO 不再更新，应该从 order_detail.po 读取

      // 更新预约明细
      const appointmentDetailLine = await tx.appointment_detail_lines.update({
        where: { id: BigInt(resolvedParams.id) },
        data: updateData,
      })

      // 如果修改了预计板数，更新相关板数字段
      if (palletsDiff !== 0) {
        if (inventoryLot && inventoryLot.pallet_count > 0) {
          // 已入库：更新 inventory_lots.unbooked_pallet_count（减去差值）
          const currentUnbooked = inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count
          const newUnbookedCount = currentUnbooked - palletsDiff
          await tx.inventory_lots.update({
            where: { inventory_lot_id: inventoryLot.inventory_lot_id },
            data: { unbooked_pallet_count: newUnbookedCount },
          })
        } else {
          // 未入库：更新 order_detail.remaining_pallets（减去差值）
          const orderDetail = await tx.order_detail.findUnique({
            where: { id: orderDetailId },
            select: { remaining_pallets: true, estimated_pallets: true },
          })
          if (orderDetail) {
            const currentRemaining = orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0
            const newRemaining = Math.max(0, currentRemaining - palletsDiff)
            await tx.order_detail.update({
              where: { id: orderDetailId },
              data: { remaining_pallets: newRemaining },
            })
          }
        }

        // 更新 delivery_appointments.total_pallets（加上差值）
        const appointment = await tx.delivery_appointments.findUnique({
          where: { appointment_id: appointmentId },
          select: { total_pallets: true },
        })
        if (appointment) {
          await tx.delivery_appointments.update({
            where: { appointment_id: appointmentId },
            data: { total_pallets: (appointment.total_pallets || 0) + palletsDiff },
          })
        }
      }

      return appointmentDetailLine
    })

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

// DELETE - 删除预约明细
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

    // 获取当前预约明细
    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { 
        appointment_id: true,
        order_detail_id: true,
        estimated_pallets: true, // 需要回退的值
      },
    })

    if (!currentLine) {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }

    const orderDetailId = currentLine.order_detail_id
    const appointmentId = currentLine.appointment_id
    const estimatedPalletsToRevert = currentLine.estimated_pallets

    // 检查是否已入库（查询 inventory_lots）
    const inventoryLot = await prisma.inventory_lots.findFirst({
      where: {
        order_detail_id: orderDetailId,
      },
      select: {
        inventory_lot_id: true,
        unbooked_pallet_count: true,
        pallet_count: true,
      },
    })

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 删除预约明细
      await tx.appointment_detail_lines.delete({
        where: { id: BigInt(resolvedParams.id) },
      })

      // 回退相关板数字段
      if (inventoryLot && inventoryLot.pallet_count > 0) {
        // 已入库：回退 inventory_lots.unbooked_pallet_count（加上旧值）
        const currentUnbooked = inventoryLot.unbooked_pallet_count ?? inventoryLot.pallet_count
        const newUnbookedCount = currentUnbooked + estimatedPalletsToRevert
        await tx.inventory_lots.update({
          where: { inventory_lot_id: inventoryLot.inventory_lot_id },
          data: { unbooked_pallet_count: newUnbookedCount },
        })
      } else {
        // 未入库：回退 order_detail.remaining_pallets（加上旧值）
        const orderDetail = await tx.order_detail.findUnique({
          where: { id: orderDetailId },
          select: { remaining_pallets: true, estimated_pallets: true },
        })
        if (orderDetail) {
          const currentRemaining = orderDetail.remaining_pallets ?? orderDetail.estimated_pallets ?? 0
          const newRemaining = currentRemaining + estimatedPalletsToRevert
          // 不能超过 estimated_pallets
          const maxRemaining = orderDetail.estimated_pallets ?? 0
          await tx.order_detail.update({
            where: { id: orderDetailId },
            data: { remaining_pallets: Math.min(newRemaining, maxRemaining) },
          })
        }
      }

      // 回退 delivery_appointments.total_pallets（减去旧值）
      const appointment = await tx.delivery_appointments.findUnique({
        where: { appointment_id: appointmentId },
        select: { total_pallets: true },
      })
      if (appointment) {
        const newTotal = Math.max(0, (appointment.total_pallets || 0) - estimatedPalletsToRevert)
        await tx.delivery_appointments.update({
          where: { appointment_id: appointmentId },
          data: { total_pallets: newTotal },
        })
      }
    })

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
