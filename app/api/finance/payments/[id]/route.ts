/**
 * 收款详情/更新/删除 API 路由 - Phase 1 骨架
 */

import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { paymentConfig } from '@/lib/crud/configs/payments'

const baseDetailHandler = createDetailHandler(paymentConfig)
const baseUpdateHandler = createUpdateHandler(paymentConfig)
const baseDeleteHandler = createDeleteHandler(paymentConfig)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDetailHandler(request, { params })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseUpdateHandler(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDeleteHandler(request, { params })
}
