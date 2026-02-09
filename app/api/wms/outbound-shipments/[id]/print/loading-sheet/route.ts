/**
 * GET /api/wms/outbound-shipments/[id]/print/loading-sheet
 * 生成装车单 PDF（与 Excel 装车单模板一致）
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission } from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail'
import { generateLoadingSheetPDF } from '@/lib/services/print/loading-sheet.service'
import { resolveLogoDataUrl } from '@/lib/services/print/resolve-logo'
import type { OAKLoadSheetData } from '@/lib/services/print/types'
import { formatDate } from '@/lib/services/print/print-templates'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permResult = await checkPermission(outboundShipmentConfig.permissions.list)
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

    const lines = await prisma.appointment_detail_lines.findMany({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        order_detail: {
          select: {
            id: true,
            order_id: true,
            estimated_pallets: true,
            remaining_pallets: true,
            locations_order_detail_delivery_location_idTolocations: {
              select: { location_code: true, name: true },
            },
            order_detail_item_order_detail_item_detail_idToorder_detail: {
              select: { detail_name: true },
            },
            orders: {
              select: { order_number: true },
            },
          },
        },
      },
    })

    // 不设默认值：没有的留空，打印后手工填写
    const destinationCode = detail.destination_location ?? ''
    const appointmentTime = (detail.confirmed_start ?? detail.requested_start)
      ? formatDate(detail.confirmed_start ?? detail.requested_start, 'long')
      : '-'

    const sheetLines = lines
      .filter((l) => l.order_detail)
      .map((l) => {
        const od = serializeBigInt(l.order_detail!)
        const loc = od.locations_order_detail_delivery_location_idTolocations
        const detailItem = Array.isArray(od.order_detail_item_order_detail_item_detail_idToorder_detail)
          ? od.order_detail_item_order_detail_item_detail_idToorder_detail[0]
          : null
        const storageLocation =
          (loc && (loc as any).location_code) ||
          (detailItem && (detailItem as any).detail_name) ||
          ''
        const containerNumber =
          (od.orders && (od.orders as any).order_number) || ''
        return {
          container_number: containerNumber,
          storage_location: storageLocation,
          planned_pallets: Number(l.estimated_pallets) || 0,
          loaded_pallets: '',   // 留空，手工填写
          remaining_pallets: '', // 留空，手工填写
          is_clear: '',         // 留空，手工填写
        }
      })

    const totalPlannedPallets = sheetLines.reduce(
      (sum, l) => sum + l.planned_pallets,
      0
    )

    const logoDataUrl = await resolveLogoDataUrl()
    const data: OAKLoadSheetData = {
      destinationLabel: '卸货仓',
      destinationCode,
      trailer: detail.trailer_code ?? '',
      loadNumber: detail.reference_number ?? '',
      sealNumber: '',
      appointmentTime,
      lines: sheetLines,
      totalPlannedPallets,
      totalIsClearLabel: '', // 留空，手工填写
      logoDataUrl: logoDataUrl ?? undefined,
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateLoadingSheetPDF(data)
    } catch (pdfErr: unknown) {
      const e = pdfErr as { code?: string; errno?: number }
      if (e?.code === 'Z_DATA_ERROR' || e?.errno === -3) {
        throw new Error('生成 PDF 时发生压缩/解压异常，请稍后重试')
      }
      throw pdfErr
    }

    const PDF_HEADER = Buffer.from('%PDF-')
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100 || !pdfBuffer.subarray(0, 5).equals(PDF_HEADER)) {
      console.error('[Loading Sheet Print] 生成的 buffer 无效，长度:', pdfBuffer?.length)
      return NextResponse.json({ error: '生成装车单失败：PDF 内容异常' }, { status: 500 })
    }

    const filename = `装车单-${detail.reference_number || appointmentId}.pdf`
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
