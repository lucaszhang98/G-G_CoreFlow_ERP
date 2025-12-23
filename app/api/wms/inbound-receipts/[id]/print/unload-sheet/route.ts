/**
 * GET /api/wms/inbound-receipts/[id]/print/unload-sheet
 * 生成入库管理的拆柜单据 PDF
 * 
 * 根据入库管理数据生成拆柜单据
 * 
 * 注意：此 API 接收前端传递的完整数据，避免重复查询数据库
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, handleError } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { generateUnloadSheetPDF } from '@/lib/services/print/unload-sheet.service'
import { UnloadSheetData } from '@/lib/services/print/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let resolvedParams: { id: string } | null = null
  let containerNumber: string | null = null
  let orderDetails: any[] | null = null
  let orderDetailsJson: string | null = null
  let unloadedBy: string | null = null
  let receivedBy: string | null = null
  let unloadDate: string | null = null
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
    containerNumber = searchParams.get('containerNumber')
    unloadedBy = searchParams.get('unloadedBy')
    receivedBy = searchParams.get('receivedBy')
    unloadDate = searchParams.get('unloadDate')
    orderDetailsJson = searchParams.get('orderDetails')

    if (!containerNumber) {
      return NextResponse.json(
        { error: '缺少必要参数：containerNumber' },
        { status: 400 }
      )
    }

    if (!orderDetailsJson) {
      return NextResponse.json(
        { error: '缺少必要参数：orderDetails' },
        { status: 400 }
      )
    }

    // 解析订单明细数据
    orderDetails = JSON.parse(orderDetailsJson)
    if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
      return NextResponse.json(
        { error: '订单明细数据不能为空' },
        { status: 400 }
      )
    }

    // 构建拆柜单据数据
    const unloadSheetData: UnloadSheetData = {
      containerNumber,
      unloadedBy: unloadedBy || undefined,
      receivedBy: receivedBy || undefined,
      unloadDate: unloadDate || undefined,
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
      inboundReceiptId: resolvedParams?.id || 'unknown',
      containerNumber: containerNumber || 'unknown',
      orderDetailsCount: orderDetails?.length || 0,
      orderDetailsJsonLength: orderDetailsJson?.length || 0,
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
