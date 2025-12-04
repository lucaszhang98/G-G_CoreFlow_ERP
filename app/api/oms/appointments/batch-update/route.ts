/**
 * 预约管理批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { deliveryAppointmentConfig } from '@/lib/crud/configs/delivery-appointments'

const batchUpdateHandler = createBatchUpdateHandler(deliveryAppointmentConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}


