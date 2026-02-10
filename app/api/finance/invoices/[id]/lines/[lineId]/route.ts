/**
 * 发票明细行：PATCH 更新、DELETE 删除
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const { id: invoiceId, lineId } = await params
    if (!invoiceId || !lineId) {
      return NextResponse.json({ error: '缺少发票 ID 或明细 ID' }, { status: 400 })
    }

    const body = await request.json() as { quantity?: number }
    const quantity = body?.quantity
    if (quantity == null) {
      return NextResponse.json({ error: '缺少 quantity' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (Number.isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 })
    }

    const invId = BigInt(invoiceId)
    const lineIdBigInt = BigInt(lineId)
    const existing = await prisma.invoice_line_items.findFirst({
      where: { id: lineIdBigInt, invoice_id: invId },
      select: { id: true, unit_price: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '明细不存在' }, { status: 404 })
    }

    const unitPrice = Number(existing.unit_price)
    const totalAmount = qty * unitPrice
    const userId = session.user?.id ? BigInt(session.user.id) : null

    const updated = await prisma.$transaction(async (tx) => {
      const line = await tx.invoice_line_items.update({
        where: { id: lineIdBigInt },
        data: {
          quantity: qty,
          total_amount: totalAmount,
          updated_by: userId,
          updated_at: new Date(),
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
      return line
    })

    return NextResponse.json({ data: serializeBigInt(updated) })
  } catch (error: any) {
    console.error('更新发票明细失败:', error)
    return NextResponse.json(
      { error: error?.message || '更新发票明细失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const { id: invoiceId, lineId } = await params
    if (!invoiceId || !lineId) {
      return NextResponse.json({ error: '缺少发票 ID 或明细 ID' }, { status: 400 })
    }

    const invId = BigInt(invoiceId)
    const lineIdBigInt = BigInt(lineId)
    const existing = await prisma.invoice_line_items.findFirst({
      where: { id: lineIdBigInt, invoice_id: invId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '明细不存在' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice_line_items.delete({
        where: { id: lineIdBigInt },
      })
      await recalcInvoiceTotal(invId, tx)
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('删除发票明细失败:', error)
    return NextResponse.json(
      { error: error?.message || '删除发票明细失败' },
      { status: 500 }
    )
  }
}
