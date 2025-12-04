/**
 * 预约管理批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { deliveryAppointmentConfig } from '@/lib/crud/configs/delivery-appointments'

const batchDeleteHandler = createBatchDeleteHandler(deliveryAppointmentConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}


