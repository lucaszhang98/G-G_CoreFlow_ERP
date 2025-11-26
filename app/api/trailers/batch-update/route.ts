/**
 * 货柜批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { trailerConfig } from '@/lib/crud/configs/trailers'

const batchUpdateHandler = createBatchUpdateHandler(trailerConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

