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
    const { quantity, volume, delivery_nature, delivery_location, fba, notes, po, window_period } = body

    // 验证和转换 delivery_location：如果是 location_code，转换为 location_id
    // delivery_location 现在应该是 location_id（BigInt）或 location_code（string）
    let validatedDeliveryLocationId: bigint | null = null
    if (delivery_location) {
      const locStr = String(delivery_location)
      // 如果是数字字符串，直接使用（location_id）
      if (/^\d+$/.test(locStr)) {
        validatedDeliveryLocationId = BigInt(locStr)
      } else {
        // 如果是 location_code，查询对应的 location_id
        const location = await prisma.locations.findFirst({
          where: { location_code: locStr },
          select: { location_id: true },
        })
        if (location) {
          validatedDeliveryLocationId = location.location_id
        } else {
          // 如果找不到对应的 location，返回错误
          return NextResponse.json(
            { error: `无效的送仓地点: ${locStr}` },
            { status: 400 }
          )
        }
      }
    }

    // 获取当前明细，用于计算
    const currentDetail = await prisma.order_detail.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { order_id: true, volume: true },
    })

    if (!currentDetail || !currentDetail.order_id) {
      return NextResponse.json({ error: '仓点明细不存在或缺少订单ID' }, { status: 404 })
    }

    // 计算预计板数：体积除以2后四舍五入，最小值为1
    const volumeNum = volume !== undefined ? (volume ? parseFloat(volume) : null) : currentDetail.volume ? Number(currentDetail.volume) : null
    const calculatedEstimatedPallets = volumeNum && volumeNum > 0 ? Math.max(1, Math.round(volumeNum / 2)) : null

    // 计算分仓占比：需要获取订单的总体积
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
      delivery_location_id: delivery_location !== undefined ? validatedDeliveryLocationId : undefined,
      fba: fba !== undefined ? fba : undefined,
      volume_percentage: calculatedVolumePercentage ? parseFloat(calculatedVolumePercentage.toFixed(2)) : null, // 自动计算，不允许用户修改
      notes: notes !== undefined ? notes : undefined,
      po: po !== undefined ? (po || null) : undefined, // PO 字段
      window_period: window_period !== undefined ? (window_period || null) : undefined, // 窗口期字段
      updated_at: new Date(),
    }
    
    // 设置 updated_by：确保 session.user.id 非空且可转换为有效的 BigInt
    if (session.user.id && session.user.id.trim() !== '') {
      try {
        const userId = BigInt(session.user.id)
        if (userId > BigInt(0)) {
          updateData.updated_by = userId
        }
      } catch (error) {
        // 转换失败时跳过，不影响其他字段的更新
      }
    }

    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    // 如果更新了 estimated_pallets，需要重新计算 remaining_pallets（未约板数）
    if (calculatedEstimatedPallets !== undefined && calculatedEstimatedPallets !== null) {
      const allAppointmentLines = await prisma.appointment_detail_lines.findMany({
        where: { order_detail_id: BigInt(resolvedParams.id) },
        select: { estimated_pallets: true, rejected_pallets: true } as { estimated_pallets: true; rejected_pallets: true },
      })
      const effective = (est: number, rej?: number | null) => (est || 0) - (rej ?? 0)
      const totalEffectivePallets = allAppointmentLines.reduce(
        (sum, line) => sum + effective(line.estimated_pallets ?? 0, (line as { rejected_pallets?: number | null }).rejected_pallets),
        0
      )
      const newRemaining = Math.max(0, calculatedEstimatedPallets - totalEffectivePallets)
      updateData.remaining_pallets = newRemaining
    }

    const orderDetail = await prisma.order_detail.update({
      where: { id: BigInt(resolvedParams.id) },
      data: updateData,
    })

    // 更新后，重新计算该订单所有明细的分仓占比
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
      
      // 更新订单的 container_volume
      await prisma.orders.update({
        where: { order_id: updatedOrder.order_id },
        data: { container_volume: totalVolume },
      })
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

    // 获取要删除的明细的订单ID
    const detailToDelete = await prisma.order_detail.findUnique({
      where: { id: BigInt(resolvedParams.id) },
      select: { order_id: true },
    })

    if (!detailToDelete?.order_id) {
      return NextResponse.json({ error: '仓点明细不存在或缺少订单ID' }, { status: 404 })
    }

    // 然后删除仓点明细
    await prisma.order_detail.delete({
      where: { id: BigInt(resolvedParams.id) },
    })

    // 删除明细后，重新计算该订单所有明细的分仓占比，并更新订单的 container_volume
    const updatedOrder = await prisma.orders.findUnique({
      where: { order_id: detailToDelete.order_id },
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
      } else {
        // 如果没有明细了，将所有明细的 volume_percentage 设为 null
        await Promise.all(
          updatedOrder.order_detail.map((detail: any) => {
            return prisma.order_detail.update({
              where: { id: detail.id },
              data: { volume_percentage: null },
            })
          })
        )
      }
      
      // 更新订单的 container_volume
      await prisma.orders.update({
        where: { order_id: detailToDelete.order_id },
        data: { container_volume: totalVolume },
      })
    } else {
      // 如果没有明细了，将订单的 container_volume 设为 0
      await prisma.orders.update({
        where: { order_id: detailToDelete.order_id },
        data: { container_volume: 0 },
      })
    }

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

