/**
 * 费用主数据 API 路由
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { feeConfig } from '@/lib/crud/configs/fees'

const baseListHandler = createListHandler(feeConfig)
const baseCreateHandler = createCreateHandler(feeConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
