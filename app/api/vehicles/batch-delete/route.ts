/**
 * 车辆批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { vehicleConfig } from '@/lib/crud/configs/vehicles'

const batchDeleteHandler = createBatchDeleteHandler(vehicleConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

