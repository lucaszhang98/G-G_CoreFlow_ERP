/**
 * 根据入库单 ID 从数据库加载数据，用于打印（批量操作时无前端传参）
 */
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

export interface LoadedReceiptForPrint {
  containerNumber: string
  customerCode: string
  orderNotes?: string // 订单备注
  plannedUnloadDate: string
  unloadedBy: string
  receivedBy: string
  unloadDate: string
  orderDetails: Array<{
    id: string
    order_detail_id?: string
    delivery_location: string
    delivery_location_code?: string
    delivery_nature?: string
    estimated_pallets: number
    quantity?: number
    volume?: number
    notes?: string
  }>
}

export async function loadInboundReceiptForPrint(
  inboundReceiptId: string
): Promise<LoadedReceiptForPrint | null> {
  const receipt = await prisma.inbound_receipt.findUnique({
    where: { inbound_receipt_id: BigInt(inboundReceiptId) },
    include: {
      orders: {
        select: {
          order_number: true,
          notes: true,
          customers: { select: { code: true } },
          order_detail: {
            select: {
              id: true,
              quantity: true,
              volume: true,
              estimated_pallets: true,
              delivery_nature: true,
              notes: true,
              po: true,
              locations_order_detail_delivery_location_idTolocations: {
                select: { location_code: true, name: true },
              },
            },
          },
        },
      },
      warehouses: { select: { name: true } },
      users_inbound_receipt_unloaded_byTousers: { select: { full_name: true, username: true } },
      users_inbound_receipt_received_byTousers: { select: { full_name: true, username: true } },
    },
  })

  if (!receipt?.orders) return null

  const serialized = serializeBigInt(receipt)
  const orderData = serialized.orders as any
  const containerNumber = orderData?.order_number || ''
  const customerCode = orderData?.customers?.code || ''
  const orderNotes = orderData?.notes != null ? String(orderData.notes) : undefined
  const plannedUnloadAt = serialized.planned_unload_at
  const plannedUnloadDate =
    typeof plannedUnloadAt === 'string'
      ? plannedUnloadAt.split('T')[0]
      : plannedUnloadAt
      ? new Date(plannedUnloadAt).toISOString().split('T')[0]
      : ''
  const unloadDate = plannedUnloadDate
  const unloadedByUser = (serialized as any).users_inbound_receipt_unloaded_byTousers
  const receivedByUser = (serialized as any).users_inbound_receipt_received_byTousers
  const unloadedBy = unloadedByUser?.full_name || unloadedByUser?.username || ''
  const receivedBy = receivedByUser?.full_name || receivedByUser?.username || ''

  const orderDetails = (orderData?.order_detail || []).map((d: any) => {
    const loc = d.locations_order_detail_delivery_location_idTolocations
    const locationCode = loc?.location_code || loc?.name || ''
    return {
      id: String(d.id),
      order_detail_id: String(d.id),
      delivery_location: locationCode,
      delivery_location_code: locationCode,
      delivery_nature: d.delivery_nature || undefined,
      estimated_pallets: Number(d.estimated_pallets) || 1,
      quantity: d.quantity != null ? Number(d.quantity) : undefined,
      volume: d.volume != null ? Number(d.volume) : undefined,
      notes: d.notes || undefined,
    }
  })

  return {
    containerNumber,
    customerCode,
    orderNotes,
    plannedUnloadDate,
    unloadedBy,
    receivedBy,
    unloadDate,
    orderDetails,
  }
}
