/**
 * 发票管理 API 路由 - Phase 1 骨架
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { invoiceConfig } from '@/lib/crud/configs/invoices'

const baseListHandler = createListHandler(invoiceConfig)
const baseCreateHandler = createCreateHandler(invoiceConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
