/**
 * GET /api/wms/outbound-shipments/[id]/print/bol
 * 生成 BOL (Bill of Lading) PDF，与 docs/135928027988 SCK8 BOL.pdf 样本一致
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkAuth,
  checkPermission,
  WMS_FULL_ACCESS_PERMISSION_OPTIONS,
} from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail'
import { getBOLPdfBuffer } from '@/app/api/wms/outbound-shipments/get-outbound-print-buffer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permResult = await checkPermission(outboundShipmentConfig.permissions.list, WMS_FULL_ACCESS_PERMISSION_OPTIONS)
    if (permResult.error) return permResult.error

    const resolvedParams = await params
    const appointmentId = resolvedParams.id
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

    const pdfBuffer = await getBOLPdfBuffer(appointmentId)
    if (!pdfBuffer) {
      return NextResponse.json({ error: '生成 BOL 失败：无明细数据' }, { status: 404 })
    }

    const destinationCode = detail.destination_location ?? ''
    const filename = `${detail.reference_number || appointmentId} ${destinationCode} BOL.pdf`
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[BOL Print]', error)
    return NextResponse.json(
      { error: error?.message || '生成BOL失败' },
      { status: 500 }
    )
  }
}
