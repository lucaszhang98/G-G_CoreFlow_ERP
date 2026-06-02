/**
 * GET /api/wms/outbound-shipments/[id]/print/loading-sheet
 * 生成装车单 PDF（与 Excel 装车单模板一致）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkAuth,
  checkPermission,
  WMS_FULL_ACCESS_PERMISSION_OPTIONS,
} from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail'
import { getLoadingSheetPdfBuffer } from '@/app/api/wms/outbound-shipments/get-outbound-print-buffer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permResult = await checkPermission(outboundShipmentConfig.permissions.list, WMS_FULL_ACCESS_PERMISSION_OPTIONS)
    if (permResult.error) return permResult.error

    const { id: appointmentId } = await params
    if (!appointmentId || isNaN(Number(appointmentId))) {
      return NextResponse.json({ error: '无效的预约ID' }, { status: 400 })
    }

    const detail = await getOutboundShipmentDetail(appointmentId)
    if (!detail) {
      return NextResponse.json(
        { error: '预约记录不存在或直送订单不在出库管理范围内' },
        { status: 404 }
      )
    }

    const pdfBuffer = await getLoadingSheetPdfBuffer(appointmentId)
    if (!pdfBuffer) {
      return NextResponse.json({ error: '生成装车单失败：无明细数据' }, { status: 404 })
    }

    const numberPart = detail.reference_number || appointmentId
    const destPart = (detail.destination_location ?? '').trim()
    const filename = destPart ? `${numberPart} ${destPart}.pdf` : `${numberPart}.pdf`
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Loading Sheet Print]', error)
    return NextResponse.json(
      { error: error?.message || '生成装车单失败' },
      { status: 500 }
    )
  }
}
