/**
 * GET /api/wms/inbound-receipts/[id]/print/labels
 * 生成入库管理的 Label PDF
 * 
 * 支持两种调用方式：
 * 1. 详情页：前端传递 orderDetails, containerNumber, customerCode, plannedUnloadDate
 * 2. 批量操作：无 query 时根据 id 从数据库加载
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, handleError } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { generateLabelsPDF } from '@/lib/services/print/label.service'
import { LabelData } from '@/lib/services/print/types'
import { loadInboundReceiptForPrint } from '../load-receipt-for-print'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let resolvedParams: { id: string } | null = null
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    resolvedParams = await params
    const searchParams = request.nextUrl.searchParams
    let orderDetails: any[]
    let containerNumber: string
    let customerCode: string
    let plannedUnloadDate: string

    const orderDetailsJson = searchParams.get('orderDetails')
    if (orderDetailsJson && searchParams.get('containerNumber') && searchParams.get('customerCode') && searchParams.get('plannedUnloadDate')) {
      containerNumber = searchParams.get('containerNumber')!
      customerCode = searchParams.get('customerCode')!
      plannedUnloadDate = searchParams.get('plannedUnloadDate')!
      orderDetails = JSON.parse(orderDetailsJson)
      if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
        return NextResponse.json({ error: '订单明细数据不能为空' }, { status: 400 })
      }
    } else {
      const loaded = await loadInboundReceiptForPrint(resolvedParams.id)
      if (!loaded || loaded.orderDetails.length === 0) {
        return NextResponse.json(
          { error: '入库单不存在或没有订单明细' },
          { status: 404 }
        )
      }
      containerNumber = loaded.containerNumber
      customerCode = loaded.customerCode
      plannedUnloadDate = loaded.plannedUnloadDate
      orderDetails = loaded.orderDetails
    }

    // 生成 Label 数据
    const labels: LabelData[] = []
    for (const detail of orderDetails) {
      const deliveryLocation = detail.delivery_location || detail.deliveryLocation || ''
      const deliveryLocationCode = deliveryLocation
      const estimatedPallets = detail.estimated_pallets || detail.estimatedPallets || 1
      const deliveryNature = detail.delivery_nature || detail.deliveryNature || undefined
      const notes = detail.notes || '' // 获取备注字段

      if (!deliveryLocationCode) {
        continue // 跳过没有仓点的明细
      }

      // 生成条形码内容：使用第一行和第二行的实际显示内容
      // 第一行：柜号
      const row1Content = containerNumber || ''
      
      // 第二行：根据性质确定显示内容（与 label-pdf.tsx 中的逻辑完全一致）
      let row2Content = ''
      if (deliveryNature === '私仓' || deliveryNature === '转仓') {
        // 私仓或转仓：显示备注（无论备注是否为空）
        row2Content = notes || ''
      } else {
        // 其他情况显示仓点
        row2Content = deliveryLocation || ''
        // 如果性质是扣货，仓点后加-hold
        if (deliveryNature === '扣货') {
          row2Content += '-hold'
        }
      }
      
      // 条形码 = 第一行 + 第二行（去除所有空格）
      const barcode = `${row1Content}${row2Content}`.replace(/\s+/g, '')

      const labelData: LabelData = {
        containerNumber,
        deliveryLocation,
        deliveryLocationCode,
        deliveryNature: deliveryNature || undefined,
        notes: notes || undefined, // 添加备注字段
        barcode,
        customerCode,
        plannedUnloadDate,
        orderDetailId: detail.id?.toString() || detail.order_detail_id?.toString() || '',
        estimatedPallets: Number(estimatedPallets),
      }

      // 根据预计板数生成多个相同的 Label（预计板数 * 4）
      const labelCount = Number(estimatedPallets) * 4
      for (let i = 0; i < labelCount; i++) {
        labels.push({ ...labelData })
      }
    }

    if (labels.length === 0) {
      return NextResponse.json(
        { error: '无法生成 Label，请检查数据完整性' },
        { status: 400 }
      )
    }

    // 生成 PDF
    const pdfBuffer = await generateLabelsPDF(labels)

    // 返回 PDF（文件名格式：{柜号}-label.pdf）
    const filename = `${containerNumber}-label.pdf`
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Labels Print] 生成失败:', {
      error,
      message: error?.message,
      stack: error?.stack,
      inboundReceiptId: resolvedParams?.id || 'unknown',
    })
    return handleError(error, '生成 Label PDF 失败')
  }
}

