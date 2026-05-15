/**
 * GET /api/finance/payments/[id]/allocations-export
 * 导出本笔收款下全部核销明细（Excel）
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkPermission } from '@/lib/api/helpers'
import { paymentConfig } from '@/lib/crud/configs/payments'
import {
  generatePaymentAllocationsExcel,
  type PaymentAllocationsExportRow,
} from '@/lib/utils/payment-allocations-export-excel'

function safeFilenamePart(s: string): string {
  return s.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').slice(0, 80) || 'payment'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permissionResult = await checkPermission(paymentConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const { id } = await params
    let paymentId: bigint
    try {
      paymentId = BigInt(id)
    } catch {
      return NextResponse.json({ error: '无效的收款 ID' }, { status: 400 })
    }

    const payment = await prisma.payments.findUnique({
      where: { payment_id: paymentId },
      include: {
        customers: { select: { code: true, name: true } },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: '收款不存在' }, { status: 404 })
    }

    const allocations = await prisma.payment_allocations.findMany({
      where: { payment_id: paymentId },
      include: {
        receivables: {
          include: {
            invoices: {
              select: {
                invoice_number: true,
                invoice_date: true,
                invoice_type: true,
                status: true,
                orders: { select: { order_number: true } },
              },
            },
            customers: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    const rows: PaymentAllocationsExportRow[] = allocations.map((a) => {
      const recv = a.receivables
      const inv = recv?.invoices
      return {
        allocation_id: String(a.id),
        receivable_id: String(a.receivable_id),
        invoice_number: inv?.invoice_number ?? null,
        invoice_date: inv?.invoice_date ?? null,
        invoice_type: inv?.invoice_type ?? null,
        invoice_status: inv?.status ?? null,
        order_number: inv?.orders?.order_number ?? null,
        customer_code: recv?.customers?.code ?? null,
        customer_name: recv?.customers?.name ?? null,
        receivable_amount: recv?.receivable_amount,
        receivable_allocated: recv?.allocated_amount,
        receivable_balance: recv?.balance,
        receivable_status: recv?.status ?? null,
        due_date: recv?.due_date ?? null,
        allocated_amount: a.allocated_amount,
        created_at: a.created_at ?? null,
      }
    })

    const buffer = await generatePaymentAllocationsExcel({
      head: {
        payment_id: String(payment.payment_id),
        payment_date: payment.payment_date,
        amount: payment.amount,
        currency: payment.currency,
        customer_code: payment.customers?.code ?? null,
        customer_name: payment.customers?.name ?? null,
      },
      rows,
    })

    const name = `收款-${safeFilenamePart(String(payment.payment_id))}-核销明细.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    })
  } catch (error: unknown) {
    console.error('[GET payments allocations-export]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    )
  }
}
