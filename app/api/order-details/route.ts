import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// POST - 创建仓点明细
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { order_id, quantity, volume, container_volume, estimated_pallets } = body

    const orderDetail = await prisma.order_detail.create({
      data: {
        order_id: BigInt(order_id),
        quantity: quantity || 0,
        volume: volume ? parseFloat(volume) : null,
        container_volume: container_volume ? parseFloat(container_volume) : null,
        estimated_pallets: estimated_pallets || null,
        created_by: session.user.id ? BigInt(session.user.id) : null,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
      },
    })

    return NextResponse.json(
      { data: serializeBigInt(orderDetail) },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('创建仓点明细失败:', error)
    return NextResponse.json(
      { error: error.message || '创建仓点明细失败' },
      { status: 500 }
    )
  }
}

