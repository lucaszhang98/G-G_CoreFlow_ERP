/**
 * 收款管理 API 路由 - Phase 1 骨架
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { paymentConfig } from '@/lib/crud/configs/payments'

const baseListHandler = createListHandler(paymentConfig)
const baseCreateHandler = createCreateHandler(paymentConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
