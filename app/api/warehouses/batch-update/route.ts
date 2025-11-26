/**
 * 仓库批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { warehouseConfig } from '@/lib/crud/configs/warehouses'

const batchUpdateHandler = createBatchUpdateHandler(warehouseConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

