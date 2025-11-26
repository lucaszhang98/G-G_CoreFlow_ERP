/**
 * 货柜批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { trailerConfig } from '@/lib/crud/configs/trailers'

const batchDeleteHandler = createBatchDeleteHandler(trailerConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

