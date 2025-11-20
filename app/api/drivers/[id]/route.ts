/**
 * 司机管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { driverConfig } from '@/lib/crud/configs/drivers'

// 使用通用框架处理 GET, PUT, DELETE
const baseDetailHandler = createDetailHandler(driverConfig)
const baseUpdateHandler = createUpdateHandler(driverConfig)
const baseDeleteHandler = createDeleteHandler(driverConfig)

/**
 * GET /api/drivers/:id
 * 获取司机详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDetailHandler(request, { params })
}

/**
 * PUT /api/drivers/:id
 * 更新司机
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseUpdateHandler(request, { params })
}

/**
 * DELETE /api/drivers/:id
 * 删除司机
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDeleteHandler(request, { params })
}
