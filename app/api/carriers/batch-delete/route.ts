/**
 * 承运商批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { carrierConfig } from '@/lib/crud/configs/carriers'

const batchDeleteHandler = createBatchDeleteHandler(carrierConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

