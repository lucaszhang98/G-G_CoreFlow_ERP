/**
 * GET /api/wms/outbound-shipments/[id]/print/bol
 * 生成 BOL (Bill of Lading) PDF，与 docs/135928027988 SCK8 BOL.pdf 样本一致
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission } from '@/lib/api/helpers'
import { outboundShipmentConfig } from '@/lib/crud/configs/outbound-shipments'
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail'
import { generateBOLPDF } from '@/lib/services/print/bol.service'
import { resolveLogoDataUrl } from '@/lib/services/print/resolve-logo'
import type { OAKBOLData } from '@/lib/services/print/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

function formatPrintTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/** 预约时间格式：YYYY-MM-DD HH:mm，不做时区转换，直接按数据库原始值显示 */
function formatAppointmentTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const str = typeof date === 'string' ? date : date.toISOString()
  // 解析 ISO 字符串的日期和时间部分，不转时区
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return ''
  const [, y, m, day, h, min] = match
  return `${y}-${m}-${day} ${h}:${min}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error
    const permResult = await checkPermission(outboundShipmentConfig.permissions.list)
    if (permResult.error) return permResult.error

    const resolvedParams = params instanceof Promise ? await params : params
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

    const appointment = await prisma.delivery_appointments.findUnique({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        locations: {
          select: {
            location_code: true,
            name: true,
            address_line1: true,
            address_line2: true,
            city: true,
            state: true,
            postal_code: true,
          },
        },
      },
    })

    const lines = await prisma.appointment_detail_lines.findMany({
      where: { appointment_id: BigInt(appointmentId) },
      include: {
        order_detail: {
          select: {
            id: true,
            order_id: true,
            estimated_pallets: true,
            quantity: true,
            fba: true,
            po: true,
            orders: {
              select: { order_number: true },
            },
            order_detail_item_order_detail_detail_idToorder_detail_item: {
              select: { fba: true },
            },
          },
        },
      },
    })

    const destinationCode = detail.destination_location ?? ''
    const location = appointment?.locations
    const shipToAddress = location
      ? [location.address_line1, location.address_line2, location.city, location.state, location.postal_code]
          .filter(Boolean)
          .join(', ') || ''
      : ''

    const shipFrom = {
      companyName: process.env.BOL_SHIP_FROM_NAME ?? 'G&G TRANSPORT INC.',
      address: process.env.BOL_SHIP_FROM_ADDRESS ?? '25503 Industrial Blvd, Dock 25- 50, Hayard, CA, 94545',
      attn: process.env.BOL_SHIP_FROM_ATTN ?? 'CJ',
      phone: process.env.BOL_SHIP_FROM_PHONE ?? '510-422-9233',
    }

    const shipTo = {
      destinationCode,
      address: shipToAddress,
      attn: '',
      phone: '',
    }

    const appointmentTime = formatAppointmentTime(detail.confirmed_start ?? detail.requested_start)

    const bolLines = lines
      .filter((l) => l.order_detail)
      .map((l) => {
        const od = serializeBigInt(l.order_detail!) as {
          fba?: string | null
          po?: string | null
          quantity?: number | null
          orders?: { order_number?: string } | null
          order_detail_item_order_detail_detail_idToorder_detail_item?: { fba?: string | null } | null
        }
        const order = od.orders
        const detailItem = od.order_detail_item_order_detail_detail_idToorder_detail_item
        const fbaFromItem = detailItem?.fba != null && detailItem.fba !== '' ? String(detailItem.fba) : ''
        const fbaRaw = od.fba != null && od.fba !== '' ? String(od.fba) : fbaFromItem
        const poRaw = od.po != null && od.po !== '' ? String(od.po) : ''
        return {
          container_number: order?.order_number ?? '',
          fba_id: fbaRaw,
          qty_plts: Number(l.estimated_pallets) ?? '',
          box: Number(od.quantity) ?? '',
          storage: '',
          po_id: poRaw,
        }
      })

    const logoDataUrl = await resolveLogoDataUrl()
    const data: OAKBOLData = {
      printTime: formatPrintTime(new Date()),
      shipFrom,
      shipTo,
      appointmentId: detail.reference_number ?? appointmentId,
      appointmentTime,
      seal: '',
      container: '',
      lines: bolLines,
      logoDataUrl: logoDataUrl ?? undefined,
    }

    const pdfBuffer = await generateBOLPDF(data)
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
