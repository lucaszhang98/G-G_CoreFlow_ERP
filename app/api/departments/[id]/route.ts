/**
 * 部门管理详情/更新/删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { departmentConfig } from '@/lib/crud/configs/departments'

// 使用通用框架处理 GET, PUT, DELETE
const baseDetailHandler = createDetailHandler(departmentConfig)
const baseUpdateHandler = createUpdateHandler(departmentConfig)
const baseDeleteHandler = createDeleteHandler(departmentConfig)

/**
 * GET /api/departments/:id
 * 获取部门详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDetailHandler(request, { params })
}

/**
 * PUT /api/departments/:id
 * 更新部门
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseUpdateHandler(request, { params })
}

/**
 * DELETE /api/departments/:id
 * 删除部门
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDeleteHandler(request, { params })
}
