/**
 * 应收详情/更新/删除 API 路由 - Phase 1 骨架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { receivableConfig } from '@/lib/crud/configs/receivables'

const baseDetailHandler = createDetailHandler(receivableConfig)
const baseUpdateHandler = createUpdateHandler(receivableConfig)
const baseDeleteHandler = createDeleteHandler(receivableConfig)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDetailHandler(request, { params })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseUpdateHandler(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return baseDeleteHandler(request, { params })
}
