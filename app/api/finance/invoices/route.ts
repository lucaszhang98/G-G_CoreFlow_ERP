/**
 * 发票管理 API 路由 - Phase 1 骨架
 * 直送(direct_delivery)：自动发票号 S+年月+4 位；拆柜(unload)：C+年月+4 位；均默认当天开票日期
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import { getNextDirectDeliveryNumber } from '@/lib/finance/next-direct-delivery-number'
import { getNextContainerUnloadInvoiceNumber } from '@/lib/finance/next-container-unload-invoice-number'

const baseListHandler = createListHandler(invoiceConfig)
const baseCreateHandler = createCreateHandler(invoiceConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (body?.invoice_type === 'storage') {
    return NextResponse.json(
      {
        error:
          '仓储账单由系统根据已入库订单与预约自动生成，不可手动创建；如需补历史数据请使用管理员接口 POST /api/admin/sync-storage-invoices',
      },
      { status: 400 }
    )
  }
  const today = new Date().toISOString().slice(0, 10)
  const defaults = {
    invoice_date: body.invoice_date ?? today,
    total_amount: body.total_amount ?? 0,
  }

  if (body?.invoice_type === 'direct_delivery') {
    const nextNumber = await getNextDirectDeliveryNumber()
    const merged = {
      ...body,
      ...defaults,
      invoice_number: body.invoice_number ?? nextNumber,
    }
    const modifiedRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(merged),
    })
    return baseCreateHandler(modifiedRequest)
  }

  if (body?.invoice_type === 'unload') {
    const nextNumber = await getNextContainerUnloadInvoiceNumber()
    const merged = {
      ...body,
      ...defaults,
      invoice_number: body.invoice_number ?? nextNumber,
    }
    const modifiedRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(merged),
    })
    return baseCreateHandler(modifiedRequest)
  }

  return baseCreateHandler(request)
}
