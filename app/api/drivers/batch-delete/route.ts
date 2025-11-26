/**
 * 司机批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { driverConfig } from '@/lib/crud/configs/drivers'

const batchDeleteHandler = createBatchDeleteHandler(driverConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

