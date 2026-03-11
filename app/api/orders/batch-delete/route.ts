/**
 * 订单批量删除 API 路由（软删除为归档，对所有人开放）
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'

const batchDeleteHandler = createBatchDeleteHandler(orderConfig)

/**
 * POST /api/orders/batch-delete
 * 批量删除（归档）订单
 */
export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}
