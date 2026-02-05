import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'

// GET - 获取订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = createDetailHandler(orderConfig)
  return handler(request, { params })
}

// PUT - 更新订单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = createUpdateHandler(orderConfig)
  return handler(request, { params })
}

// DELETE - 删除订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = createDeleteHandler(orderConfig)
  return handler(request, { params })
}

