/**
 * 车辆管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { vehicleConfig } from '@/lib/crud/configs/vehicles'

// 使用通用框架处理 GET, PUT, DELETE
const baseDetailHandler = createDetailHandler(vehicleConfig)
const baseUpdateHandler = createUpdateHandler(vehicleConfig)
const baseDeleteHandler = createDeleteHandler(vehicleConfig)

/**
 * GET /api/vehicles/:id
 * 获取车辆详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDetailHandler(request, { params })
}

/**
 * PUT /api/vehicles/:id
 * 更新车辆
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseUpdateHandler(request, { params })
}

/**
 * DELETE /api/vehicles/:id
 * 删除车辆
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDeleteHandler(request, { params })
}
