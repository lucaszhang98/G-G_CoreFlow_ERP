/**
 * 应收管理 API 路由 - Phase 1 骨架
 */

import { NextRequest } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { receivableConfig } from '@/lib/crud/configs/receivables'

const baseListHandler = createListHandler(receivableConfig)
const baseCreateHandler = createCreateHandler(receivableConfig)

export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
