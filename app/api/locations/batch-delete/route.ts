/**
 * 位置批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { locationConfig } from '@/lib/crud/configs/locations'

const batchDeleteHandler = createBatchDeleteHandler(locationConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

