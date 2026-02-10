/**
 * 根据入库单 ID 生成打印 PDF Buffer，供单条接口与批量合并接口共用
 */
import { generateUnloadSheetPDF } from '@/lib/services/print/unload-sheet.service'
import { generateLabelsPDF } from '@/lib/services/print/label.service'
import type { UnloadSheetData, LabelData } from '@/lib/services/print/types'
import { loadInboundReceiptForPrint } from './[id]/print/load-receipt-for-print'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

export async function getUnloadSheetPdfBuffer(
  inboundReceiptId: string
): Promise<Buffer | null> {
  const loaded = await loadInboundReceiptForPrint(inboundReceiptId)
  if (!loaded || loaded.orderDetails.length === 0) return null
  const unloadSheetData: UnloadSheetData = {
    containerNumber: loaded.containerNumber,
    customerCode: loaded.customerCode || undefined,
    orderNotes: loaded.orderNotes || undefined,
    unloadedBy: loaded.unloadedBy || undefined,
    receivedBy: loaded.receivedBy || undefined,
    unloadDate: loaded.unloadDate || undefined,
    orderDetails: loaded.orderDetails.map((d: any) => ({
      deliveryNature: d.delivery_nature || d.deliveryNature || undefined,
      deliveryLocation: d.delivery_location || d.deliveryLocation || undefined,
      quantity: d.quantity !== undefined ? Number(d.quantity) : undefined,
      notes: d.notes || undefined,
    })),
  }
  const pdfBuffer = await generateUnloadSheetPDF(unloadSheetData)
  return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as ArrayBuffer)
}

export async function getLabelsPdfBuffer(
  inboundReceiptId: string
): Promise<Buffer | null> {
  const loaded = await loadInboundReceiptForPrint(inboundReceiptId)
  if (!loaded || loaded.orderDetails.length === 0) return null
  const { containerNumber, customerCode, plannedUnloadDate, orderDetails } = loaded
  const labels: LabelData[] = []
  for (const detail of orderDetails) {
    const deliveryLocation = detail.delivery_location || ''
    const deliveryLocationCode = deliveryLocation
    const estimatedPallets = detail.estimated_pallets ?? 1
    const deliveryNature = detail.delivery_nature ?? undefined
    const notes = detail.notes ?? ''
    if (!deliveryLocationCode) continue
    let row2Content = ''
    if (deliveryNature === '私仓' || deliveryNature === '转仓') {
      row2Content = notes || ''
    } else {
      row2Content = deliveryLocation || ''
      if (deliveryNature === '扣货') row2Content += '-hold'
    }
    const barcode = `${containerNumber || ''}${row2Content}`.replace(/\s+/g, '')
    const labelData: LabelData = {
      containerNumber,
      deliveryLocation,
      deliveryLocationCode,
      deliveryNature: deliveryNature || undefined,
      notes: notes || undefined,
      barcode,
      customerCode,
      plannedUnloadDate,
      orderDetailId: detail.id?.toString() || detail.order_detail_id?.toString() || '',
      estimatedPallets: Number(estimatedPallets),
    }
    const labelCount = Number(estimatedPallets) * 4
    for (let i = 0; i < labelCount; i++) labels.push({ ...labelData })
  }
  if (labels.length === 0) return null
  const pdfBuffer = await generateLabelsPDF(labels)
  return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as ArrayBuffer)
}

/** 批量拆柜单据：1 次查询拉取全部入库单数据，返回按 ids 顺序的 UnloadSheetData，null 表示无数据。 */
export async function loadBatchUnloadSheetData(
  ids: string[]
): Promise<(UnloadSheetData | null)[]> {
  if (ids.length === 0) return []
  const idSet = ids.map((id) => BigInt(id))
  const receipts = await prisma.inbound_receipt.findMany({
    where: { inbound_receipt_id: { in: idSet } },
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
    },
  })
  const receiptMap = new Map<string, (typeof receipts)[0]>()
  for (const r of receipts) {
    if (r.orders) receiptMap.set(r.inbound_receipt_id.toString(), r)
  }
  const result: (UnloadSheetData | null)[] = []
  for (const id of ids) {
    const receipt = receiptMap.get(id)
    if (!receipt?.orders) {
      result.push(null)
      continue
    }
    const serialized = serializeBigInt(receipt)
    const orderData = serialized.orders as any
    const containerNumber = orderData?.order_number || ''
    const customerCode = orderData?.customers?.code || ''
    const plannedUnloadAt = serialized.planned_unload_at
    const plannedUnloadDate =
      typeof plannedUnloadAt === 'string'
        ? plannedUnloadAt.split('T')[0]
        : plannedUnloadAt
        ? new Date(plannedUnloadAt).toISOString().split('T')[0]
        : ''
    const orderDetails = (orderData?.order_detail || []).map((d: any) => {
      const loc = d.locations_order_detail_delivery_location_idTolocations
      const locationCode = loc?.location_code || loc?.name || ''
      return {
        deliveryNature: d.delivery_nature || d.deliveryNature || undefined,
        deliveryLocation: locationCode || undefined,
        quantity: d.quantity != null ? Number(d.quantity) : undefined,
        notes: d.notes || undefined,
      }
    })
    if (orderDetails.length === 0) {
      result.push(null)
      continue
    }
    result.push({
      containerNumber,
      customerCode: customerCode || undefined,
      orderNotes: orderData?.notes != null ? String(orderData.notes) : undefined,
      unloadedBy: serialized.unloaded_by != null ? String(serialized.unloaded_by) : undefined,
      receivedBy: serialized.received_by != null ? String(serialized.received_by) : undefined,
      unloadDate: plannedUnloadDate || undefined,
      orderDetails,
    })
  }
  return result
}
