/**
 * 司机批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { driverConfig } from '@/lib/crud/configs/drivers'

const batchUpdateHandler = createBatchUpdateHandler(driverConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

