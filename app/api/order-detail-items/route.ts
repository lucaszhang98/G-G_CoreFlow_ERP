import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// POST - 创建SKU明细
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { detail_id, detail_name, sku, description, stock_quantity, volume, status, fba } = body

    if (!detail_name || !sku) {
      return NextResponse.json({ error: '明细名称和SKU为必填项' }, { status: 400 })
    }

    const orderDetailItem = await prisma.order_detail_item.create({
      data: {
        detail_id: detail_id ? BigInt(detail_id) : null,
        detail_name: detail_name,
        sku: sku,
        description: description || null,
        stock_quantity: stock_quantity !== undefined ? stock_quantity : null,
        volume: volume ? parseFloat(volume) : null,
        status: status || 'active',
        fba: fba || null,
        created_by: session.user.id ? BigInt(session.user.id) : null,
        updated_by: session.user.id ? BigInt(session.user.id) : null,
      },
    })

    return NextResponse.json(
      { data: serializeBigInt(orderDetailItem) },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('创建SKU明细失败:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '明细名称已存在' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error.message || '创建SKU明细失败' },
      { status: 500 }
    )
  }
}

