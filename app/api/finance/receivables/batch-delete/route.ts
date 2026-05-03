/**
 * POST /api/finance/receivables/batch-delete
 * 使用通用批量删除（应收：与单条删除一致的事务逻辑）
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { receivableConfig } from '@/lib/crud/configs/receivables'

const batchDeleteHandler = createBatchDeleteHandler(receivableConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}
