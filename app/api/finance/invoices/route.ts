/**
 * 发票管理 API 路由 - Phase 1 骨架
 * 直送账单(direct_delivery)创建时自动生成发票号(S+年月+4位顺序)并默认开票日期为当天
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import { getNextDirectDeliveryNumber } from '@/lib/finance/next-direct-delivery-number'

const baseListHandler = createListHandler(invoiceConfig)
const baseCreateHandler = createCreateHandler(invoiceConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (body?.invoice_type === 'direct_delivery') {
    const nextNumber = await getNextDirectDeliveryNumber()
    const today = new Date().toISOString().slice(0, 10)
    const merged = {
      ...body,
      invoice_number: body.invoice_number ?? nextNumber,
      invoice_date: body.invoice_date ?? today,
      total_amount: body.total_amount ?? 0,
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
