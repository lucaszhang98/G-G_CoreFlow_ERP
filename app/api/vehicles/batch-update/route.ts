/**
 * 车辆批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { vehicleConfig } from '@/lib/crud/configs/vehicles'

const batchUpdateHandler = createBatchUpdateHandler(vehicleConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

