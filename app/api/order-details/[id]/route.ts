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
    const { quantity, volume, container_volume, estimated_pallets } = body

    const orderDetail = await prisma.order_detail.update({
      where: { id: BigInt(resolvedParams.id) },
      data: {
        quantity: quantity !== undefined ? quantity : undefined,
        volume: volume !== undefined ? (volume ? parseFloat(volume) : null) : undefined,
        container_volume: container_volume !== undefined ? (container_volume ? parseFloat(container_volume) : null) : undefined,
        estimated_pallets: estimated_pallets !== undefined ? estimated_pallets : undefined,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      data: serializeBigInt(orderDetail)
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

