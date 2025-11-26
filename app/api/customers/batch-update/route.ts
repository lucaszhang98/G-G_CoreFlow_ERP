/**
 * 客户批量更新 API 路由
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { customerConfig } from '@/lib/crud/configs/customers'

const batchUpdateHandler = createBatchUpdateHandler(customerConfig)

/**
 * POST /api/customers/batch-update
 * 批量更新客户
 */
export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

