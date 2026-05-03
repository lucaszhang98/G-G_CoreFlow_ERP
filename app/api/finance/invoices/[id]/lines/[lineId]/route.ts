/**
 * 发票明细行：PATCH 更新、DELETE 删除
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { serializeBigInt } from '@/lib/api/helpers'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import {
  downgradeAuditedInvoiceAfterLineMutation,
  getReceivableWithdrawBlockReason,
} from '@/lib/finance/invoice-receivable-sync'

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

    const body = (await request.json()) as {
      quantity?: number
      unit_price?: number
      line_notes?: string | null
    }

    const hasQ = body.quantity !== undefined
    const hasP = body.unit_price !== undefined
    const hasN = body.line_notes !== undefined
    if (!hasQ && !hasP && !hasN) {
      return NextResponse.json(
        { error: '请至少提供 quantity、unit_price、line_notes 之一' },
        { status: 400 }
      )
    }

    const invId = BigInt(invoiceId)
    const lineIdBigInt = BigInt(lineId)
    const parentInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: invId },
      select: { invoice_type: true, status: true },
    })
    if (!parentInvoice) {
      return NextResponse.json({ error: '账单不存在' }, { status: 404 })
    }
    if (parentInvoice.invoice_type === 'storage') {
      return NextResponse.json(
        { error: '仓储账单明细由系统根据预约与入库自动维护，不可手动修改' },
        { status: 400 }
      )
    }
    if (parentInvoice.status === 'audited') {
      const block = await getReceivableWithdrawBlockReason(prisma, invId)
      if (block) {
        return NextResponse.json({ error: block }, { status: 409 })
      }
    }
    const allowNegativeAmounts = parentInvoice.invoice_type === 'penalty'

    const existing = await prisma.invoice_line_items.findFirst({
      where: { id: lineIdBigInt, invoice_id: invId },
      select: {
        id: true,
        quantity: true,
        unit_price: true,
        line_notes: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: '明细不存在' }, { status: 404 })
    }

    const qtyNum = hasQ ? Number(body.quantity) : Number(existing.quantity)
    const priceNum = hasP ? Number(body.unit_price) : Number(existing.unit_price)

    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 })
    }
    if (
      Number.isNaN(priceNum) ||
      (!allowNegativeAmounts && priceNum < 0)
    ) {
      return NextResponse.json({ error: '单价无效' }, { status: 400 })
    }

    const totalAmount = qtyNum * priceNum
    const nextNotes = hasN ? (body.line_notes === '' ? null : body.line_notes) : existing.line_notes

    const userId = session.user?.id ? BigInt(session.user.id) : null

    const updated = await prisma.$transaction(async (tx) => {
      const line = await tx.invoice_line_items.update({
        where: { id: lineIdBigInt },
        data: {
          quantity: new Prisma.Decimal(qtyNum.toFixed(6)),
          unit_price: new Prisma.Decimal(priceNum.toFixed(2)),
          total_amount: new Prisma.Decimal(totalAmount.toFixed(2)),
          line_notes: nextNotes,
          updated_by: userId,
          updated_at: new Date(),
        },
      })
      await recalcInvoiceTotal(invId, tx)
      await downgradeAuditedInvoiceAfterLineMutation(tx, invId, userId)
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

    const parentForDelete = await prisma.invoices.findUnique({
      where: { invoice_id: invId },
      select: { status: true, invoice_type: true },
    })
    if (parentForDelete?.invoice_type === 'storage') {
      return NextResponse.json(
        { error: '仓储账单明细由系统根据预约与入库自动维护，不可手动删除' },
        { status: 400 }
      )
    }
    if (parentForDelete?.status === 'audited') {
      const block = await getReceivableWithdrawBlockReason(prisma, invId)
      if (block) {
        return NextResponse.json({ error: block }, { status: 409 })
      }
    }

    const userId = session.user?.id ? BigInt(session.user.id) : null

    await prisma.$transaction(async (tx) => {
      await tx.invoice_line_items.delete({
        where: { id: lineIdBigInt },
      })
      await recalcInvoiceTotal(invId, tx)
      await downgradeAuditedInvoiceAfterLineMutation(tx, invId, userId)
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
