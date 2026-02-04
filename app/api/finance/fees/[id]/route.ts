/**
 * 费用详情/更新/删除 API 路由
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { feeConfig } from '@/lib/crud/configs/fees'

const baseDetailHandler = createDetailHandler(feeConfig)
const baseUpdateHandler = createUpdateHandler(feeConfig)
const baseDeleteHandler = createDeleteHandler(feeConfig)

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
