/**
 * POST /api/finance/invoices/create-from-container
 * 按柜号（订单 order_number）查找订单；操作方式为直送则同步直送账单，拆柜则同步拆柜账单（与订单侧逻辑一致）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import prisma from '@/lib/prisma'
import { syncDirectDeliveryInvoiceForOrder } from '@/lib/finance/direct-delivery-sync'
import { syncContainerUnloadInvoiceForOrder } from '@/lib/finance/container-unload-sync'
import { syncStorageInvoiceForOrder } from '@/lib/finance/storage-invoice-sync'
import {
  findOperationalOrderByNumber,
  formatOperationalOrderNotFoundMessage,
} from '@/lib/orders/operational-order-lookup'

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

    const order = await findOperationalOrderByNumber({
      orderNumber: container_number,
      select: {
        order_id: true,
        customer_id: true,
        order_number: true,
        operation_mode: true,
        status: true,
      },
    })

    if (!order) {
      const msg = await formatOperationalOrderNotFoundMessage(container_number)
      return NextResponse.json({ error: msg }, { status: 404 })
    }

    if (order.customer_id == null) {
      return NextResponse.json({ error: '该订单未关联客户，无法创建账单' }, { status: 400 })
    }

    if (order.operation_mode !== 'direct_delivery' && order.operation_mode !== 'unload') {
      return NextResponse.json(
        { error: '该订单操作方式需为直送或拆柜才可按柜号同步账单' },
        { status: 400 }
      )
    }

    const result =
      order.operation_mode === 'direct_delivery'
        ? await syncDirectDeliveryInvoiceForOrder(order.order_id, userId)
        : await syncContainerUnloadInvoiceForOrder(order.order_id, userId)
    if (!result.ok || result.invoice_id == null) {
      return NextResponse.json(
        { error: result.error ?? '同步账单失败' },
        { status: 500 }
      )
    }

    if (order.operation_mode === 'unload') {
      try {
        await syncStorageInvoiceForOrder(order.order_id, userId)
      } catch (e) {
        console.warn('[create-from-container] 仓储账单同步失败（不影响拆柜账单返回）', e)
      }
    }

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: result.invoice_id },
    })

    return NextResponse.json({
      data: invoice ? serializeBigInt(invoice) : null,
      order_number: order.order_number,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建直送账单失败'
    console.error('[create-from-container]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
