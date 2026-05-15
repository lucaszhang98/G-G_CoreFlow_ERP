/**
 * POST /api/finance/payments/batch-delete
 * 批量删除收款：逐笔冲回应收已核销后再删收款
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { paymentConfig } from '@/lib/crud/configs/payments'

const batchDeleteHandler = createBatchDeleteHandler(paymentConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}
