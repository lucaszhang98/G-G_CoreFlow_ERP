/**
 * Label 生成服务
 * 
 * 功能：
 * 1. 根据订单明细生成 Label 数据
 * 2. 生成 PDF（4×6英寸，横向）
 * 3. 支持批量生成（一个明细生成 预计板数*4 个相同的 Label）
 */

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
  try {
    // 查询订单明细及相关数据
    // 注意：先查询订单明细，再单独查询 inbound_receipt，避免复杂的嵌套 include
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
      },
    } as any) // 使用 as any 避免类型检查问题

    if (!orderDetail) {
      throw new Error(`订单明细不存在: ${orderDetailId}`)
    }

    const orderDetailAny = orderDetail as any
    const order = orderDetailAny?.orders
    
    if (!order) {
      throw new Error(`订单明细 ${orderDetailId} 缺少关联的订单`)
    }
    
    const customer = order?.customers

    // 获取柜号（订单号）
    const containerNumber = order?.order_number || ''

    if (!containerNumber) {
      throw new Error(`订单明细 ${orderDetailId} 关联的订单缺少订单号 (order_number)`)
    }

    // 获取仓点（delivery_location）
    const deliveryLocation = orderDetailAny?.delivery_location || ''
    const deliveryLocationCode = orderDetailAny?.delivery_location || ''
    
    if (!deliveryLocationCode) {
      throw new Error(`订单明细 ${orderDetailId} 缺少仓点代码 (delivery_location)`)
    }

    // 获取性质（delivery_nature）
    const deliveryNature = orderDetailAny?.delivery_nature || null

    // 获取客户代码
    const customerCode = customer?.code || ''
    
    if (!customerCode) {
      throw new Error(`订单 ${order?.order_id} 缺少客户代码`)
    }

    // 获取预计拆柜日期（必须，从关联的 inbound_receipt 获取）
    let plannedUnloadDate = ''
    
    // 直接从订单的关联 inbound_receipt 获取（更直接的方式）
    if (order?.order_id) {
      try {
        const inboundReceipt = await prisma.inbound_receipt.findUnique({
          where: { order_id: order.order_id },
          select: { planned_unload_at: true },
        })
        if (inboundReceipt?.planned_unload_at) {
          plannedUnloadDate = formatDate(inboundReceipt.planned_unload_at, 'short')
        }
      } catch (error: any) {
        console.error(`查询 inbound_receipt 失败 (order_id: ${order.order_id}):`, error)
        // 继续执行，稍后会检查 plannedUnloadDate 是否为空
      }
    }

    // 必须要有预计拆柜日期
    if (!plannedUnloadDate) {
      throw new Error(`订单明细 ${orderDetailId} 关联的入库管理记录缺少预计拆柜日期 (planned_unload_at)`)
    }

    // 获取预计板数
    const estimatedPallets = orderDetailAny?.estimated_pallets 
      ? Number(orderDetailAny.estimated_pallets) 
      : 1

    // 生成条形码内容：柜号+仓点代码（无分隔符）
    const barcode = `${containerNumber}${deliveryLocationCode}`.replace(/\s+/g, '')

    // 创建单个 Label 数据
    const labelData: LabelData = {
      containerNumber,
      deliveryLocation,
      deliveryLocationCode,
      deliveryNature: deliveryNature || undefined,
      barcode,
      customerCode,
      plannedUnloadDate,
      orderDetailId: orderDetailId.toString(),
      estimatedPallets,
    }

    // 根据预计板数生成多个相同的 Label（预计板数 * 4）
    const labelCount = estimatedPallets * 4
    return Array(labelCount).fill(null).map(() => ({ ...labelData }))
  } catch (error: any) {
    console.error(`[generateLabelDataFromOrderDetail] 处理订单明细 ${orderDetailId} 失败:`, error)
    throw error
  }
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
  if (!orderDetailIds || !Array.isArray(orderDetailIds) || orderDetailIds.length === 0) {
    throw new Error('订单明细ID列表不能为空')
  }

  const allLabels: LabelData[] = []

  for (const orderDetailId of orderDetailIds) {
    try {
      const labels = await generateLabelDataFromOrderDetail(orderDetailId)
      if (labels && Array.isArray(labels) && labels.length > 0) {
        allLabels.push(...labels)
      }
    } catch (error: any) {
      console.error(`生成订单明细 ${orderDetailId} 的 Label 失败:`, error)
      // 抛出错误，让调用方知道具体哪个明细失败了
      throw new Error(`生成订单明细 ${orderDetailId} 的 Label 失败: ${error.message || error}`)
    }
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
    // 创建一个较大的 canvas 用于生成条形码
    const tempCanvas = createCanvas(400, 100)
    
    // JsBarcode 可以直接传入 canvas 对象
    JsBarcode(tempCanvas, barcodeText, {
      format: 'CODE128',
      width: 2,
      height: 80,
      displayValue: false, // 不显示文本
      margin: 0, // 无外边距
      background: 'transparent', // 透明背景
    })
    
    // 获取条形码的实际边界（去除空白）
    const ctx = tempCanvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data
    
    // 找到条形码的实际边界
    let minX = tempCanvas.width
    let minY = tempCanvas.height
    let maxX = 0
    let maxY = 0
    
    for (let y = 0; y < tempCanvas.height; y++) {
      for (let x = 0; x < tempCanvas.width; x++) {
        const idx = (y * tempCanvas.width + x) * 4
        const alpha = data[idx + 3]
        if (alpha > 0) { // 有像素
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    
    // 如果找到了条形码区域，裁剪它
    if (minX < maxX && minY < maxY) {
      const width = maxX - minX + 1
      const height = maxY - minY + 1
      
      // 创建新的 canvas，只包含条形码区域
      const croppedCanvas = createCanvas(width, height)
      const croppedCtx = croppedCanvas.getContext('2d')
      
      // 绘制裁剪后的条形码
      croppedCtx.drawImage(
        tempCanvas,
        minX, minY, width, height,
        0, 0, width, height
      )
      
      return croppedCanvas.toDataURL('image/png')
    }
    
    // 如果没找到边界，返回原始 canvas
    return tempCanvas.toDataURL('image/png')
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
  if (!labels || !Array.isArray(labels) || labels.length === 0) {
    throw new Error('Label 数据不能为空')
  }

  // 为每个 Label 生成条形码图片
  const barcodeImages = labels.map(label => {
    if (!label || !label.barcode) {
      console.warn('Label 数据缺少条形码:', label)
      return ''
    }
    return generateBarcodeImage(label.barcode)
  })

  // 使用 @react-pdf/renderer 生成 PDF
  const pdfDoc = <LabelsDocument labels={labels} barcodeImages={barcodeImages} />
  
  // 渲染为 Buffer
  const pdfBuffer = await renderToBuffer(pdfDoc)
  
  return pdfBuffer
}
