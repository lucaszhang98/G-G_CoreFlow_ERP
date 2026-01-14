/**
 * GET /api/wms/inbound-receipts/[id]/print/labels
 * 生成入库管理的 Label PDF
 * 
 * 根据入库管理关联的订单明细生成 Label
 * 每个明细生成 预计板数*4 个 Label
 * 
 * 注意：此 API 接收前端传递的完整数据，避免重复查询数据库
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, handleError } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { generateLabelsPDF } from '@/lib/services/print/label.service'
import { LabelData } from '@/lib/services/print/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let resolvedParams: { id: string } | null = null
  try {
    // 检查登录
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    // 检查权限（使用 list 权限，因为打印是查看操作）
    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    resolvedParams = params instanceof Promise ? await params : params
    
    // 从查询参数获取数据（前端传递）
    const searchParams = request.nextUrl.searchParams
    const orderDetailsJson = searchParams.get('orderDetails')
    const containerNumber = searchParams.get('containerNumber')
    const customerCode = searchParams.get('customerCode')
    const plannedUnloadDate = searchParams.get('plannedUnloadDate')

    if (!orderDetailsJson || !containerNumber || !customerCode || !plannedUnloadDate) {
      return NextResponse.json(
        { error: '缺少必要参数：orderDetails, containerNumber, customerCode, plannedUnloadDate' },
        { status: 400 }
      )
    }

    // 解析订单明细数据
    const orderDetails = JSON.parse(orderDetailsJson)
    if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
      return NextResponse.json(
        { error: '订单明细数据不能为空' },
        { status: 400 }
      )
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

      // 生成条形码内容：柜号+仓点代码（无分隔符）
      const barcode = `${containerNumber}${deliveryLocationCode}`.replace(/\s+/g, '')

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

