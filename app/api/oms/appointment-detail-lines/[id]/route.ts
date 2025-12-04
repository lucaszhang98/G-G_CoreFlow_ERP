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
    const { estimated_pallets, po } = body

    // 获取当前预约明细，用于获取 order_detail_id
    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { order_detail_id: true },
    })

    if (!currentLine) {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }

    const updateData: any = {
      updated_by: session.user.id ? BigInt(session.user.id) : null,
      updated_at: new Date(),
    }

    if (estimated_pallets !== undefined) {
      updateData.estimated_pallets = parseInt(estimated_pallets) || 0
    }

    if (po !== undefined) {
      updateData.po = po || null
    }

    // 更新预约明细
    const appointmentDetailLine = await prisma.appointment_detail_lines.update({
      where: { id: BigInt(resolvedParams.id) },
      data: updateData,
    })

    // 重新计算并更新 order_detail.remaining_pallets
    await updateRemainingPallets(currentLine.order_detail_id)

    return NextResponse.json({
      success: true,
      data: serializeBigInt(appointmentDetailLine)
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

    // 获取当前预约明细，用于获取 order_detail_id
    const currentLine = await prisma.appointment_detail_lines.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { order_detail_id: true },
    })

    if (!currentLine) {
      return NextResponse.json({ 
        success: false,
        error: '预约明细不存在' 
      }, { status: 404 })
    }

    // 删除预约明细
    await prisma.appointment_detail_lines.delete({
      where: { id: BigInt(resolvedParams.id) },
    })

    // 重新计算并更新 order_detail.remaining_pallets
    await updateRemainingPallets(currentLine.order_detail_id)

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

// 辅助函数：更新 order_detail 的剩余板数
async function updateRemainingPallets(orderDetailId: bigint) {
  try {
    // 获取 order_detail 的总板数
    const orderDetail = await prisma.order_detail.findUnique({
      where: { id: orderDetailId },
      select: { estimated_pallets: true },
    })

    if (!orderDetail || !orderDetail.estimated_pallets) {
      return
    }

    const totalPallets = orderDetail.estimated_pallets

    // 计算所有预约的预计板数之和
    const appointmentLines = await prisma.appointment_detail_lines.findMany({
      where: { order_detail_id: orderDetailId },
      select: { estimated_pallets: true },
    })

    const totalAppointmentPallets = appointmentLines.reduce((sum, line) => {
      return sum + (line.estimated_pallets || 0)
    }, 0)

    // 计算剩余板数
    const remainingPallets = Math.max(0, totalPallets - totalAppointmentPallets)

    // 更新 order_detail.remaining_pallets
    await prisma.order_detail.update({
      where: { id: orderDetailId },
      data: { remaining_pallets: remainingPallets },
    })
  } catch (error) {
    console.error('更新剩余板数失败:', error)
    throw error
  }
}

