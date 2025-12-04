import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// PUT - 更新仓点明细
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const resolvedParams = params instanceof Promise ? await params : params
    const body = await request.json()
    const { quantity, volume, delivery_nature, delivery_location, unload_type, notes, po } = body

    // 获取当前明细，用于计算
    const currentDetail = await prisma.order_detail.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { order_id: true, volume: true },
    })

    if (!currentDetail || !currentDetail.order_id) {
      return NextResponse.json({ error: '仓点明细不存在或缺少订单ID' }, { status: 404 })
    }

    // 计算预计板数：体积除以2后四舍五入
    const volumeNum = volume !== undefined ? (volume ? parseFloat(volume) : null) : currentDetail.volume ? Number(currentDetail.volume) : null
    const calculatedEstimatedPallets = volumeNum && volumeNum > 0 ? Math.round(volumeNum / 2) : null

    // 计算分仓占总柜比：需要获取订单的总体积
    const order = await prisma.orders.findUnique({
      where: { order_id: currentDetail.order_id },
      select: {
        order_id: true,
        order_detail: {
          select: { id: true, volume: true },
        },
      },
    })

    // 计算更新后的总体积
    const existingTotalVolume = order?.order_detail?.reduce((sum: number, detail: any) => {
      const vol = detail.volume ? Number(detail.volume) : 0
      // 如果是当前正在更新的明细，使用新值；否则使用旧值
      if (detail.id.toString() === resolvedParams.id) {
        return sum + (volumeNum || 0)
      }
      return sum + vol
    }, 0) || 0

    const calculatedVolumePercentage = existingTotalVolume > 0 && volumeNum ? (volumeNum / existingTotalVolume) * 100 : null

    const updateData: any = {
      quantity: quantity !== undefined ? quantity : undefined,
      volume: volume !== undefined ? (volume ? parseFloat(volume) : null) : undefined,
      estimated_pallets: calculatedEstimatedPallets, // 自动计算，不允许用户修改
      delivery_nature: delivery_nature !== undefined ? delivery_nature : undefined,
      delivery_location: delivery_location !== undefined ? (delivery_location ? String(delivery_location) : null) : undefined,
      unload_type: unload_type !== undefined ? unload_type : undefined,
      volume_percentage: calculatedVolumePercentage ? parseFloat(calculatedVolumePercentage.toFixed(2)) : null, // 自动计算，不允许用户修改
      notes: notes !== undefined ? notes : undefined,
      po: po !== undefined ? (po || null) : undefined, // PO 字段
      updated_by: session.user.id ? BigInt(session.user.id) : null,
      updated_at: new Date(),
    }
    
    // 处理 null 值：将 null 转换为 undefined，这样 Prisma 会忽略它们
    if (updateData.updated_by === null) {
      updateData.updated_by = undefined
    }

    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    const orderDetail = await prisma.order_detail.update({
      where: { id: BigInt(resolvedParams.id) },
      data: updateData,
    })

    // 更新后，重新计算该订单所有明细的分仓占总柜比
    const updatedOrder = await prisma.orders.findUnique({
      where: { order_id: currentDetail.order_id },
      select: {
        order_id: true,
        order_detail: {
          select: { id: true, volume: true },
        },
      },
    })

    if (updatedOrder?.order_detail) {
      // 计算总体积
      const totalVolume = updatedOrder.order_detail.reduce((sum: number, detail: any) => {
        const vol = detail.volume ? Number(detail.volume) : 0
        return sum + vol
      }, 0)

      // 更新所有明细的 volume_percentage
      if (totalVolume > 0) {
        await Promise.all(
          updatedOrder.order_detail.map((detail: any) => {
            const vol = detail.volume ? Number(detail.volume) : 0
            const percentage = vol > 0 ? parseFloat(((vol / totalVolume) * 100).toFixed(2)) : null
            return prisma.order_detail.update({
              where: { id: detail.id },
              data: { volume_percentage: percentage },
            })
          })
        )
      }
    }

    // 重新获取更新后的明细（包含重新计算的 volume_percentage）
    const finalOrderDetail = await prisma.order_detail.findUnique({
      where: { id: BigInt(resolvedParams.id) },
    })

    return NextResponse.json({
      data: serializeBigInt(finalOrderDetail || orderDetail)
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '仓点明细不存在' }, { status: 404 })
    }
    console.error('更新仓点明细失败:', error)
    return NextResponse.json(
      { error: error.message || '更新仓点明细失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除仓点明细（会级联删除关联的SKU明细）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const resolvedParams = params instanceof Promise ? await params : params

    // 先删除关联的SKU明细
    await prisma.order_detail_item.deleteMany({
      where: { detail_id: BigInt(resolvedParams.id) },
    })

    // 然后删除仓点明细
    await prisma.order_detail.delete({
      where: { id: BigInt(resolvedParams.id) },
    })

    return NextResponse.json({ message: '仓点明细删除成功' })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '仓点明细不存在' }, { status: 404 })
    }
    console.error('删除仓点明细失败:', error)
    return NextResponse.json(
      { error: error.message || '删除仓点明细失败' },
      { status: 500 }
    )
  }
}

