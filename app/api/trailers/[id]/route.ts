/**
 * 货柜管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { trailerConfig } from '@/lib/crud/configs/trailers'

// 使用通用框架处理 GET, PUT, DELETE
const baseDetailHandler = createDetailHandler(trailerConfig)
const baseUpdateHandler = createUpdateHandler(trailerConfig)
const baseDeleteHandler = createDeleteHandler(trailerConfig)

/**
 * GET /api/trailers/:id
 * 获取货柜详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDetailHandler(request, { params })
}

/**
 * PUT /api/trailers/:id
 * 更新货柜
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseUpdateHandler(request, { params })
}

/**
 * DELETE /api/trailers/:id
 * 删除货柜
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDeleteHandler(request, { params })
}
