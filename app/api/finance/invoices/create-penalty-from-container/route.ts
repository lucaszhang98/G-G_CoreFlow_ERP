/**
 * POST /api/finance/invoices/create-penalty-from-container
 * 按柜号创建负数账单：主行从订单带出客户/柜号，明细一条 other，备注「返利」，单价默认 -100。
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import prisma from '@/lib/prisma'
import { createPenaltyRebateInvoiceFromContainerNumber } from '@/lib/finance/penalty-bill-from-container'

export async function POST(request: NextRequest) {
  try {
    const perm = await checkPermission(invoiceConfig.permissions.create ?? [])
    if (perm.error) return perm.error

    const body = await request.json().catch(() => ({}))
    const raw = typeof body.container_number === 'string' ? body.container_number : ''
    const container_number = raw.trim()
    if (!container_number) {
      return NextResponse.json({ error: '请输入柜号' }, { status: 400 })
    }

    const userId = perm.user?.id != null ? BigInt(perm.user.id) : null

    const result = await createPenaltyRebateInvoiceFromContainerNumber(
      container_number,
      userId
    )

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      )
    }

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: result.invoice_id },
    })

    return NextResponse.json({
      data: invoice ? serializeBigInt(invoice) : null,
      order_number: result.order_number,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建负数账单失败'
    console.error('[create-penalty-from-container]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
