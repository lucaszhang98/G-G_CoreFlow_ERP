/**
 * 发票明细行：GET 列表、POST 新增
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const { id: invoiceId } = await context.params
    if (!invoiceId) {
      return NextResponse.json({ error: '缺少发票 ID' }, { status: 400 })
    }

    const lines = await prisma.invoice_line_items.findMany({
      where: { invoice_id: BigInt(invoiceId) },
      include: {
        fee: {
          select: {
            id: true,
            fee_code: true,
            fee_name: true,
            unit: true,
            unit_price: true,
            currency: true,
            scope_type: true,
            container_type: true,
            description: true,
            is_active: true,
          },
        },
      },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    })

    const data = lines.map((line) => {
      const serialized = serializeBigInt(line)
      return {
        ...serialized,
        fee_code: line.fee?.fee_code,
        fee_name: line.fee?.fee_name,
        unit: line.fee?.unit,
        currency: line.fee?.currency,
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('获取发票明细失败:', error)
    return NextResponse.json(
      { error: error?.message || '获取发票明细失败' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const { id: invoiceId } = await context.params
    if (!invoiceId) {
      return NextResponse.json({ error: '缺少发票 ID' }, { status: 400 })
    }

    const body = await request.json()
    const fee_id = body?.fee_id != null ? Number(body.fee_id) : undefined
    const quantity = body?.quantity != null ? Number(body.quantity) : undefined
    if (fee_id == null || quantity == null) {
      return NextResponse.json(
        { error: '缺少 fee_id 或 quantity' },
        { status: 400 }
      )
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 })
    }

    const fee = await prisma.fee.findUnique({
      where: { id: BigInt(fee_id) },
      select: { unit_price: true },
    })
    if (!fee) {
      return NextResponse.json({ error: '费用不存在' }, { status: 404 })
    }

    const unitPrice = Number(fee.unit_price)
    const totalAmount = quantity * unitPrice
    const invId = BigInt(invoiceId)
    const userId = session.user?.id ? BigInt(session.user.id) : null

    const line = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice_line_items.create({
        data: {
          invoice_id: invId,
          fee_id: BigInt(fee_id),
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          created_by: userId,
          updated_by: userId,
        },
        include: {
          fee: {
            select: {
              fee_code: true,
              fee_name: true,
              unit: true,
              currency: true,
            },
          },
        },
      })
      await recalcInvoiceTotal(invId, tx)
      return created
    })

    return NextResponse.json(
      {
        data: serializeBigInt(line),
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('添加发票明细失败:', error)
    return NextResponse.json(
      { error: error?.message || '添加发票明细失败' },
      { status: 500 }
    )
  }
}
