/**
 * 发票明细行：GET 列表、POST 新增
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import { listFeesForInvoiceLinePicker, type FeeForMatch } from '@/lib/finance/fee-matching'
import {
  downgradeAuditedInvoiceAfterLineMutation,
  getReceivableWithdrawBlockReason,
} from '@/lib/finance/invoice-receivable-sync'

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

    // 不用 include fee：自动出账明细 fee_id 为空，避免可选关联在部分环境下 join 异常；快照字段优先，仅对旧数据用 fee_id 补全展示
    const lines = await prisma.invoice_line_items.findMany({
      where: { invoice_id: BigInt(invoiceId) },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    })

    const feeIds = [
      ...new Set(
        lines.map((l) => l.fee_id).filter((id): id is bigint => id != null)
      ),
    ]
    const fees =
      feeIds.length > 0
        ? await prisma.fee.findMany({
            where: { id: { in: feeIds } },
            select: {
              id: true,
              fee_code: true,
              fee_name: true,
              unit: true,
              currency: true,
            },
          })
        : []
    const feeById = new Map(fees.map((f) => [f.id.toString(), f]))

    const data = lines.map((line) => {
      const fee = line.fee_id != null ? feeById.get(line.fee_id.toString()) : undefined
      const serialized = serializeBigInt(line)
      return {
        ...serialized,
        fee_code: line.fee_code ?? fee?.fee_code,
        fee_name: line.fee_name ?? fee?.fee_name,
        unit: line.unit ?? fee?.unit,
        currency: fee?.currency,
        line_notes: line.line_notes,
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
    const unitPriceOverride =
      body?.unit_price != null && body.unit_price !== ''
        ? Number(body.unit_price)
        : undefined
    const lineNotes =
      typeof body?.line_notes === 'string' ? body.line_notes.trim() || null : null

    if (fee_id == null || quantity == null) {
      return NextResponse.json(
        { error: '缺少 fee_id 或 quantity' },
        { status: 400 }
      )
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: '数量必须大于 0' }, { status: 400 })
    }

    const invId = BigInt(invoiceId)
    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: invId },
      select: {
        customer_id: true,
        invoice_type: true,
        status: true,
        orders: { select: { container_type: true } },
      },
    })
    if (!invoice) {
      return NextResponse.json({ error: '账单不存在' }, { status: 404 })
    }
    if (invoice.invoice_type === 'storage') {
      return NextResponse.json(
        { error: '仓储账单明细由系统根据预约与入库自动维护，不可手动添加' },
        { status: 400 }
      )
    }
    if (invoice.status === 'audited') {
      const block = await getReceivableWithdrawBlockReason(prisma, invId)
      if (block) {
        return NextResponse.json({ error: block }, { status: 409 })
      }
    }
    if (invoice.customer_id == null) {
      return NextResponse.json({ error: '账单缺少客户' }, { status: 400 })
    }

    const allowNegativeAmounts = invoice.invoice_type === 'penalty'
    if (
      unitPriceOverride != null &&
      (Number.isNaN(unitPriceOverride) ||
        (!allowNegativeAmounts && unitPriceOverride < 0))
    ) {
      return NextResponse.json({ error: '单价无效' }, { status: 400 })
    }

    const fee = await prisma.fee.findUnique({
      where: { id: BigInt(fee_id) },
      include: {
        fee_scope: { select: { customer_id: true } },
      },
    })
    if (!fee) {
      return NextResponse.json({ error: '费用不存在' }, { status: 404 })
    }

    const containerType = invoice.orders?.container_type ?? null
    const rawFees = await prisma.fee.findMany({
      where: {
        OR: [
          { customer_id: invoice.customer_id },
          { scope_type: 'all' },
          { fee_scope: { some: { customer_id: invoice.customer_id } } },
        ],
      },
      include: { fee_scope: { select: { customer_id: true } } },
    })
    const selectable = listFeesForInvoiceLinePicker(
      rawFees as FeeForMatch[],
      invoice.customer_id,
      containerType
    )
    if (!selectable.some((r) => r.id === (fee as FeeForMatch).id)) {
      return NextResponse.json(
        { error: '该费用与当前账单客户或柜型不匹配' },
        { status: 400 }
      )
    }

    const unitPrice =
      unitPriceOverride != null ? unitPriceOverride : Number(fee.unit_price)
    const totalAmount = quantity * unitPrice
    const userId = session.user?.id ? BigInt(session.user.id) : null

    const line = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice_line_items.create({
        data: {
          invoice_id: invId,
          fee_id: null,
          fee_code: fee.fee_code,
          fee_name: fee.fee_name,
          unit: fee.unit,
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          line_notes: lineNotes,
          created_by: userId,
          updated_by: userId,
        },
      })
      await recalcInvoiceTotal(invId, tx)
      await downgradeAuditedInvoiceAfterLineMutation(tx, invId, userId)
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
