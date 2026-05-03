import { NextRequest } from 'next/server'
import { createDetailHandler, createUpdateHandler, createDeleteHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'
import { scheduleDirectDeliveryInvoiceSync } from '@/lib/finance/direct-delivery-sync'
import { scheduleContainerUnloadInvoiceSync } from '@/lib/finance/container-unload-sync'
import { scheduleStorageInvoiceSync } from '@/lib/finance/storage-invoice-sync'
import { auth } from '@/auth'

// GET - 获取订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = createDetailHandler(orderConfig)
  return handler(request, { params })
}

// PUT - 更新订单（直送操作方式变更时同步直送账单）
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const handler = createUpdateHandler(orderConfig)
  const res = await handler(request, context)
  if (res.ok) {
    const { id } = await context.params
    if (id) {
      const session = await auth()
      const userId = session?.user?.id ? BigInt(session.user.id) : undefined
      scheduleDirectDeliveryInvoiceSync(BigInt(id), userId)
      scheduleContainerUnloadInvoiceSync(BigInt(id), userId)
      scheduleStorageInvoiceSync(BigInt(id), userId)
    }
  }
  return res
}

// DELETE - 删除订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = createDeleteHandler(orderConfig)
  return handler(request, { params })
}

