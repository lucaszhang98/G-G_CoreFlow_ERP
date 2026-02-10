/**
 * GET /api/wms/inbound-receipts/[id]/print/unload-sheet
 * 生成入库管理的拆柜单据 PDF
 *
 * 支持两种调用方式：
 * 1. 详情页：前端传递 containerNumber, orderDetails 等
 * 2. 批量操作：无 query 时根据 id 从数据库加载
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, handleError } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { generateUnloadSheetPDF } from '@/lib/services/print/unload-sheet.service'
import { UnloadSheetData } from '@/lib/services/print/types'
import { loadInboundReceiptForPrint } from '../load-receipt-for-print'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let resolvedParams: { id: string } | null = null
  let containerNumber: string = ''
  let orderDetails: any[] = []
  let customerCode: string | undefined
  let orderNotes: string | undefined
  let unloadedBy: string | undefined
  let receivedBy: string | undefined
  let unloadDate: string | undefined
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    resolvedParams = await params
    const searchParams = request.nextUrl.searchParams
    const orderDetailsJson = searchParams.get('orderDetails')

    if (searchParams.get('containerNumber') && orderDetailsJson) {
      containerNumber = searchParams.get('containerNumber')!
      customerCode = searchParams.get('customerCode') || undefined
      orderNotes = searchParams.get('orderNotes') || undefined
      unloadedBy = searchParams.get('unloadedBy') || undefined
      receivedBy = searchParams.get('receivedBy') || undefined
      unloadDate = searchParams.get('unloadDate') || undefined
      orderDetails = JSON.parse(orderDetailsJson)
      if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
        return NextResponse.json({ error: '订单明细数据不能为空' }, { status: 400 })
      }
      // 详情页未传 orderNotes 时，从数据库补取订单备注
      if ((orderNotes == null || orderNotes === '') && resolvedParams.id) {
        const loaded = await loadInboundReceiptForPrint(resolvedParams.id)
        orderNotes = loaded?.orderNotes ?? undefined
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
      customerCode = loaded.customerCode || undefined
      orderNotes = loaded.orderNotes || undefined
      unloadedBy = loaded.unloadedBy || undefined
      receivedBy = loaded.receivedBy || undefined
      unloadDate = loaded.unloadDate || undefined
      orderDetails = loaded.orderDetails
    }

    const unloadSheetData: UnloadSheetData = {
      containerNumber,
      customerCode,
      orderNotes,
      unloadedBy,
      receivedBy,
      unloadDate,
      orderDetails: orderDetails.map((detail: any) => ({
        // 从详情页获取的数据
        deliveryNature: detail.delivery_nature || detail.deliveryNature || undefined,
        deliveryLocation: detail.delivery_location || detail.deliveryLocation || undefined,
        quantity: detail.quantity !== undefined ? Number(detail.quantity) : undefined,
        notes: detail.notes || undefined,
        
        // 留白等工人填写（初始为空，不设置值）
        // actualPallets, storageLocation, workerNotes 留空
      })),
    }

    // 生成 PDF
    console.log('[Unload Sheet API] 调用PDF生成服务...')
    const pdfBuffer = await generateUnloadSheetPDF(unloadSheetData)
    console.log('[Unload Sheet API] PDF生成成功，准备返回响应')

    // 返回 PDF（文件名格式：{柜号}-拆柜单据.pdf）
    const filename = `${containerNumber}-拆柜单据.pdf`
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || '未知错误',
      name: error?.name || error?.constructor?.name || typeof error,
      stack: error?.stack,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      path: error?.path,
    }
    
    console.error('[Unload Sheet Print] 生成失败:', {
      error: errorDetails,
      inboundReceiptId: resolvedParams?.id ?? 'unknown',
      containerNumber: containerNumber || 'unknown',
      orderDetailsCount: orderDetails.length,
      hasUnloadedBy: !!unloadedBy,
      hasReceivedBy: !!receivedBy,
      hasUnloadDate: !!unloadDate,
    })
    
    // 返回更详细的错误信息，方便调试
    return NextResponse.json(
      { 
        error: '生成拆柜单据 PDF 失败',
        details: process.env.NODE_ENV === 'production' 
          ? { message: errorDetails.message } // 生产环境只返回消息
          : errorDetails // 开发环境返回详细信息
      },
      { status: 500 }
    )
  }
}

