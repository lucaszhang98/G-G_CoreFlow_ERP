/**
 * Label 生成服务
 * 
 * 功能：
 * 1. 根据订单明细生成 Label 数据
 * 2. 生成 PDF（4×6英寸，横向）
 * 3. 支持批量生成（一个明细生成 预计板数*4 个相同的 Label）
 */

import React from 'react'
import prisma from '@/lib/prisma'
import { LabelData } from './types'
import { formatDate } from './print-templates'
import { renderToBuffer } from '@react-pdf/renderer'
import { LabelsDocument } from './label-pdf'
import JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'

/**
 * 从订单明细生成 Label 数据
 * 
 * @param orderDetailId 订单明细ID
 * @returns Label 数据数组（每个明细生成 预计板数*4 个相同的 Label）
 */
export async function generateLabelDataFromOrderDetail(
  orderDetailId: bigint
): Promise<LabelData[]> {
  // 查询订单明细及相关数据
  // 使用 include 时，主表的所有字段（包括 notes, delivery_nature, estimated_pallets 等）都会被返回
  const orderDetail = await prisma.order_detail.findUnique({
    where: { id: orderDetailId },
    include: {
      orders: {
        include: {
          customers: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        select: {
          order_number: true,
          order_id: true,
        },
      },
      // 查找关联的入库管理记录（获取预计拆柜日期）
      inventory_lots: {
        take: 1, // 只需要一个批次来获取 inbound_receipt
        include: {
          inbound_receipt: {
            select: {
              planned_unload_at: true,
            },
          },
        },
      },
      // 获取 delivery_location_id 关联的 location 数据
      locations_order_detail_delivery_location_idTolocations: {
        select: {
          location_id: true,
          location_code: true,
          name: true,
        },
      },
    },
  })

  if (!orderDetail) {
    throw new Error(`订单明细不存在: ${orderDetailId}`)
  }

  const order = orderDetail.orders
  const customer = order?.customers

  // 获取柜号（订单号）
  const containerNumber = order?.order_number || ''

  // 获取仓点（delivery_location_id 关联的 location_code）
  const deliveryLocationCode = orderDetail.locations_order_detail_delivery_location_idTolocations?.location_code || ''
  const deliveryLocation = deliveryLocationCode
  
  if (!deliveryLocationCode) {
    throw new Error(`订单明细 ${orderDetailId} 缺少仓点代码 (delivery_location_id)`)
  }

  // 获取送仓性质（delivery_nature）
  const deliveryNature = orderDetail.delivery_nature || ''

  // 获取备注（用于私仓时显示）
  const notes = orderDetail.notes || ''

  // 获取客户代码
  const customerCode = customer?.code || ''
  
  if (!customerCode) {
    throw new Error(`订单 ${order?.order_id} 缺少客户代码`)
  }

  // 获取预计拆柜日期（必须，从关联的 inbound_receipt 获取）
  let plannedUnloadDate = ''
  if (orderDetail.inventory_lots && orderDetail.inventory_lots.length > 0) {
    const plannedUnloadAt = orderDetail.inventory_lots[0]?.inbound_receipt?.planned_unload_at
    if (plannedUnloadAt) {
      plannedUnloadDate = formatDate(plannedUnloadAt, 'short')
    }
  }

  // 如果没有从 inventory_lots 获取到，尝试从订单的关联 inbound_receipt 获取
  if (!plannedUnloadDate && order?.order_id) {
    const inboundReceipt = await prisma.inbound_receipt.findFirst({
      where: { order_id: order.order_id },
      select: { planned_unload_at: true },
    })
    if (inboundReceipt?.planned_unload_at) {
      plannedUnloadDate = formatDate(inboundReceipt.planned_unload_at, 'short')
    }
  }

  // 必须要有预计拆柜日期
  if (!plannedUnloadDate) {
    throw new Error(`订单明细 ${orderDetailId} 关联的入库管理记录缺少预计拆柜日期 (planned_unload_at)`)
  }

  // 获取预计板数
  const estimatedPallets = orderDetail.estimated_pallets 
    ? Number(orderDetail.estimated_pallets) 
    : 1

  // 生成条形码内容：柜号+仓点代码（无分隔符）
  const barcode = `${containerNumber}${deliveryLocationCode}`.replace(/\s+/g, '')

  // 创建单个 Label 数据
  const labelData: LabelData = {
    containerNumber,
    deliveryLocation,
    deliveryLocationCode,
    deliveryNature,
    notes,
    barcode,
    customerCode,
    plannedUnloadDate,
    orderDetailId: orderDetailId.toString(),
    estimatedPallets,
  }

  // 根据预计板数生成多个相同的 Label（预计板数 * 4）
  const labelCount = estimatedPallets * 4
  return Array(labelCount).fill(null).map(() => ({ ...labelData }))
}

/**
 * 从多个订单明细批量生成 Label 数据
 * 
 * @param orderDetailIds 订单明细ID数组
 * @returns 所有 Label 数据数组
 */
export async function generateLabelDataFromOrderDetails(
  orderDetailIds: bigint[]
): Promise<LabelData[]> {
  const allLabels: LabelData[] = []

  for (const orderDetailId of orderDetailIds) {
    const labels = await generateLabelDataFromOrderDetail(orderDetailId)
    allLabels.push(...labels)
  }

  return allLabels
}

/**
 * 生成条形码图片（Base64）
 * 
 * @param barcodeText 条形码文本
 * @returns Base64 编码的图片数据
 */
function generateBarcodeImage(barcodeText: string): string {
  try {
    const canvas = createCanvas(200, 50)
    
    // JsBarcode 可以直接传入 canvas 对象
    JsBarcode(canvas, barcodeText, {
      format: 'CODE128',
      width: 2,
      height: 40,
      displayValue: false, // 不显示文本，我们在 PDF 中单独显示
      margin: 0,
    })
    
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('生成条形码失败:', error)
    // 如果生成失败，返回空字符串，PDF 中只显示文本
    return ''
  }
}

/**
 * 生成 Label PDF
 * 
 * @param labelData Label 数据
 * @returns PDF Buffer
 */
export async function generateLabelPDF(labelData: LabelData): Promise<Buffer> {
  return generateLabelsPDF([labelData])
}

/**
 * 批量生成 Label PDF
 * 
 * @param labels Label 数据数组
 * @returns PDF Buffer（多页 PDF，每页一个 Label）
 */
export async function generateLabelsPDF(labels: LabelData[]): Promise<Buffer> {
  if (labels.length === 0) {
    throw new Error('Label 数据不能为空')
  }

  // 为每个 Label 生成条形码图片
  const barcodeImages = labels.map(label => generateBarcodeImage(label.barcode))

  // 使用 @react-pdf/renderer 生成 PDF
  const pdfDoc = <LabelsDocument labels={labels} barcodeImages={barcodeImages} />
  
  // 渲染为 Buffer
  const pdfBuffer = await renderToBuffer(pdfDoc)
  
  return pdfBuffer
}
