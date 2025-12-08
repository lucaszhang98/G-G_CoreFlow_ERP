/**
 * 订单批量更新 API 路由
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'

const batchUpdateHandler = createBatchUpdateHandler(orderConfig)

/**
 * POST /api/orders/batch-update
 * 批量更新订单
 */
export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}


