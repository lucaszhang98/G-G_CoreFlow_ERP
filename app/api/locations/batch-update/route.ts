/**
 * 位置批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { locationConfig } from '@/lib/crud/configs/locations'

const batchUpdateHandler = createBatchUpdateHandler(locationConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

