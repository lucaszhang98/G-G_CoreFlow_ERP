import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// PUT - 更新SKU明细
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { detail_name, sku, description, stock_quantity, volume, status, fba } = body

    const orderDetailItem = await prisma.order_detail_item.update({
      where: { id: BigInt(resolvedParams.id) },
      data: {
        detail_name: detail_name !== undefined ? detail_name : undefined,
        sku: sku !== undefined ? sku : undefined,
        description: description !== undefined ? description : undefined,
        stock_quantity: stock_quantity !== undefined ? stock_quantity : undefined,
        volume: volume !== undefined ? (volume ? parseFloat(volume) : null) : undefined,
        status: status !== undefined ? status : undefined,
        fba: fba !== undefined ? fba : undefined,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      data: serializeBigInt(orderDetailItem)
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'SKU明细不存在' }, { status: 404 })
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '明细名称已存在' }, { status: 409 })
    }
    console.error('更新SKU明细失败:', error)
    return NextResponse.json(
      { error: error.message || '更新SKU明细失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除SKU明细
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const resolvedParams = await params

    await prisma.order_detail_item.delete({
      where: { id: BigInt(resolvedParams.id) },
    })

    return NextResponse.json({ message: 'SKU明细删除成功' })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'SKU明细不存在' }, { status: 404 })
    }
    console.error('删除SKU明细失败:', error)
    return NextResponse.json(
      { error: error.message || '删除SKU明细失败' },
      { status: 500 }
    )
  }
}

