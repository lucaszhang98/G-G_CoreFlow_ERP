/**
 * 承运商批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { carrierConfig } from '@/lib/crud/configs/carriers'

const batchUpdateHandler = createBatchUpdateHandler(carrierConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

