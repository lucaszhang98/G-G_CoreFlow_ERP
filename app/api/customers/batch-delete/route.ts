/**
 * 客户批量删除 API 路由
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { customerConfig } from '@/lib/crud/configs/customers'

const batchDeleteHandler = createBatchDeleteHandler(customerConfig)

/**
 * POST /api/customers/batch-delete
 * 批量删除客户
 */
export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

