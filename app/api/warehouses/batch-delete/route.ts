/**
 * 仓库批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { warehouseConfig } from '@/lib/crud/configs/warehouses'

const batchDeleteHandler = createBatchDeleteHandler(warehouseConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

