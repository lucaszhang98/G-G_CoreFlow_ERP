/**
 * 承运商管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { carrierConfig } from '@/lib/crud/configs/carriers'

// 使用通用框架处理 GET, PUT, DELETE
const baseDetailHandler = createDetailHandler(carrierConfig)
const baseUpdateHandler = createUpdateHandler(carrierConfig)
const baseDeleteHandler = createDeleteHandler(carrierConfig)

/**
 * GET /api/carriers/:id
 * 获取承运商详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDetailHandler(request, { params })
}

/**
 * PUT /api/carriers/:id
 * 更新承运商
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseUpdateHandler(request, { params })
}

/**
 * DELETE /api/carriers/:id
 * 删除承运商
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDeleteHandler(request, { params })
}
