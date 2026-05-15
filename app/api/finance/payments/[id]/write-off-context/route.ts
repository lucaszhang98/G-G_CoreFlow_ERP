/**
 * GET 收款消账弹窗所需上下文：收款信息、已核销合计、可再核销余额、客户下未结清应收列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { paymentConfig } from '@/lib/crud/configs/payments'
import prisma from '@/lib/prisma'

function receivableOpenBalance(r: {
  receivable_amount: unknown
  allocated_amount: unknown | null
  balance: unknown | null
}): number {
  if (r.balance != null && r.balance !== '') {
    return Number(r.balance)
  }
  return Number(r.receivable_amount) - Number(r.allocated_amount ?? 0)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(paymentConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { id } = await params
    const paymentId = BigInt(id)

    const payment = await prisma.payments.findUnique({
      where: { payment_id: paymentId },
      select: {
        payment_id: true,
        customer_id: true,
        payment_date: true,
        amount: true,
        currency: true,
        bank_reference: true,
        notes: true,
        customers: { select: { id: true, code: true, name: true } },
      },
    })
    if (!payment) {
      return NextResponse.json({ error: '收款记录不存在' }, { status: 404 })
    }

    const sumAgg = await prisma.payment_allocations.aggregate({
      where: { payment_id: paymentId },
      _sum: { allocated_amount: true },
    })
    const allocatedTotal = Number(sumAgg._sum.allocated_amount ?? 0)
    const paymentAmount = Number(payment.amount)
    const remaining = Math.max(0, paymentAmount - allocatedTotal)

    const receivableRows = await prisma.receivables.findMany({
      where: { customer_id: payment.customer_id },
      include: {
        invoices: {
          select: {
            invoice_id: true,
            invoice_number: true,
            total_amount: true,
            invoice_date: true,
          },
        },
      },
      take: 500,
    })

    type OpenRow = {
      receivable_id: bigint
      invoice_id: bigint
      invoice_number: string | null
      receivable_amount: number
      allocated_amount: number
      balance: number
      invoice_date: Date | null
    }

    const openReceivables: OpenRow[] = receivableRows
      .map((r) => ({
        receivable_id: r.receivable_id,
        invoice_id: r.invoice_id,
        invoice_number: r.invoices?.invoice_number ?? null,
        receivable_amount: Number(r.receivable_amount),
        allocated_amount: Number(r.allocated_amount ?? 0),
        balance: receivableOpenBalance(r),
        invoice_date: r.invoices?.invoice_date ?? null,
      }))
      .filter((r) => r.balance > 1e-6)
      .sort((a, b) => {
        const ta =
          a.invoice_date != null
            ? new Date(a.invoice_date).getTime()
            : Number.MAX_SAFE_INTEGER
        const tb =
          b.invoice_date != null
            ? new Date(b.invoice_date).getTime()
            : Number.MAX_SAFE_INTEGER
        if (ta !== tb) return ta - tb
        if (a.receivable_id < b.receivable_id) return -1
        if (a.receivable_id > b.receivable_id) return 1
        return 0
      })

    const openReceivablesPayload = openReceivables.map((r) => ({
      receivable_id: r.receivable_id,
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      receivable_amount: r.receivable_amount,
      allocated_amount: r.allocated_amount,
      balance: r.balance,
    }))

    return NextResponse.json({
      data: serializeBigInt({
        payment: {
          ...payment,
          allocated_total: allocatedTotal,
          remaining,
        },
        open_receivables: openReceivablesPayload,
      }),
    })
  } catch (error: any) {
    console.error('[GET write-off-context]', error)
    return NextResponse.json(
      { error: error?.message || '加载失败' },
      { status: 500 }
    )
  }
}
