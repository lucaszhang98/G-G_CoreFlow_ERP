/**
 * 根据预约 ID 生成出库打印 PDF Buffer，供单条接口与批量合并接口共用
 */
import { getOutboundShipmentDetail } from '@/lib/services/outbound-shipment-detail'
import { generateBOLPDF } from '@/lib/services/print/bol.service'
import { generateLoadingSheetPDF } from '@/lib/services/print/loading-sheet.service'
import { resolveLogoDataUrl } from '@/lib/services/print/resolve-logo'
import { formatDate } from '@/lib/services/print/print-templates'
import type { OAKBOLData, OAKLoadSheetData } from '@/lib/services/print/types'
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

/** 与装车单预约时间一致：完整 YYYY-MM-DD HH:mm:ss，仅日期时补 00:00:00，无值显示 - */
function formatAppointmentTime(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return '-'
  const str = typeof date === 'string' ? date : (date as Date).toISOString()
  const withTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (withTime) {
    const [, y, m, day, h, min, sec] = withTime
    return `${y}-${m}-${day} ${h}:${min}:${sec ?? '00'}`
  }
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const [, y, m, day] = dateOnly
    return `${y}-${m}-${day} 00:00:00`
  }
  return '-'
}

export async function getBOLPdfBuffer(appointmentId: string): Promise<Buffer | null> {
  if (!appointmentId || isNaN(Number(appointmentId))) return null
  const detail = await getOutboundShipmentDetail(appointmentId)
  if (!detail) return null

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
          orders: { select: { order_number: true } },
          order_detail_item_order_detail_detail_idToorder_detail_item: { select: { fba: true } },
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
    address: (detail.delivery_address && String(detail.delivery_address).trim()) ? String(detail.delivery_address).trim() : shipToAddress,
    attn: detail.contact_name ?? '',
    phone: detail.contact_phone ?? '',
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
      const lineWithNotes = l as { bol_notes?: string | null }
      return {
        container_number: order?.order_number ?? '',
        bol_notes: lineWithNotes.bol_notes ?? null,
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
  return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as ArrayBuffer)
}

const BOL_SHIP_FROM = {
  companyName: process.env.BOL_SHIP_FROM_NAME ?? 'G&G TRANSPORT INC.',
  address: process.env.BOL_SHIP_FROM_ADDRESS ?? '25503 Industrial Blvd, Dock 25- 50, Hayard, CA, 94545',
  attn: process.env.BOL_SHIP_FROM_ATTN ?? 'CJ',
  phone: process.env.BOL_SHIP_FROM_PHONE ?? '510-422-9233',
}

/** 批量 BOL：2 次查询拉取全部数据，返回按 ids 顺序的 OAKBOLData（不含 logo），null 表示直送跳过。 */
export async function loadBatchBOLData(ids: string[]): Promise<(OAKBOLData | null)[]> {
  if (ids.length === 0) return []
  const idSet = ids.map((id) => BigInt(id))

  const [appointments, allLines] = await Promise.all([
    prisma.delivery_appointments.findMany({
      where: { appointment_id: { in: idSet } },
      include: {
        orders: { select: { status: true } },
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
        outbound_shipments: {
          select: {
            delivery_address: true,
            contact_name: true,
            contact_phone: true,
          },
        },
      },
    }),
    prisma.appointment_detail_lines.findMany({
      where: { appointment_id: { in: idSet } },
      include: {
        order_detail: {
          select: {
            id: true,
            order_id: true,
            estimated_pallets: true,
            quantity: true,
            fba: true,
            po: true,
            orders: { select: { order_number: true } },
            order_detail_item_order_detail_detail_idToorder_detail_item: { select: { fba: true } },
          },
        },
      },
    }),
  ])

  const appointmentMap = new Map<string, (typeof appointments)[0]>()
  for (const a of appointments) {
    if (a.orders?.status !== 'direct_delivery') {
      appointmentMap.set(a.appointment_id.toString(), a)
    }
  }
  const linesByAppointment = new Map<string, typeof allLines>()
  for (const line of allLines) {
    const key = line.appointment_id.toString()
    if (!linesByAppointment.has(key)) linesByAppointment.set(key, [])
    linesByAppointment.get(key)!.push(line)
  }

  const result: (OAKBOLData | null)[] = []
  for (const id of ids) {
    const appointment = appointmentMap.get(id)
    if (!appointment) {
      result.push(null)
      continue
    }
    const lines = linesByAppointment.get(id) ?? []
    const serialized = serializeBigInt(appointment)
    const location = serialized.locations as any
    const destinationCode = location?.location_code ?? ''
    const shipToAddress = location
      ? [location.address_line1, location.address_line2, location.city, location.state, location.postal_code]
          .filter(Boolean)
          .join(', ') || ''
      : ''
    const outbound = Array.isArray(serialized.outbound_shipments)
      ? serialized.outbound_shipments[0]
      : serialized.outbound_shipments
    const ob = outbound as { delivery_address?: string | null; contact_name?: string | null; contact_phone?: string | null } | undefined
    const shipToAddressFinal = (ob?.delivery_address && String(ob.delivery_address).trim()) ? String(ob.delivery_address).trim() : shipToAddress
    const appointmentTime = formatAppointmentTime(serialized.confirmed_start ?? serialized.requested_start)
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
        const lineWithNotes = l as { bol_notes?: string | null }
        return {
          container_number: order?.order_number ?? '',
          bol_notes: lineWithNotes.bol_notes ?? null,
          fba_id: fbaRaw,
          qty_plts: Number(l.estimated_pallets) ?? '',
          box: Number(od.quantity) ?? '',
          storage: '',
          po_id: poRaw,
        }
      })
    result.push({
      printTime: formatPrintTime(new Date()),
      shipFrom: BOL_SHIP_FROM,
      shipTo: {
        destinationCode,
        address: shipToAddressFinal,
        attn: ob?.contact_name ?? '',
        phone: ob?.contact_phone ?? '',
      },
      appointmentId: serialized.reference_number ?? id,
      appointmentTime,
      seal: '',
      container: '',
      lines: bolLines,
      logoDataUrl: undefined,
    })
  }
  return result
}

export async function getLoadingSheetPdfBuffer(appointmentId: string): Promise<Buffer | null> {
  if (!appointmentId || isNaN(Number(appointmentId))) return null
  const detail = await getOutboundShipmentDetail(appointmentId)
  if (!detail) return null

  const lines = await prisma.appointment_detail_lines.findMany({
    where: { appointment_id: BigInt(appointmentId) },
    include: {
      order_detail: {
        select: {
          id: true,
          order_id: true,
          estimated_pallets: true,
          remaining_pallets: true,
          delivery_nature: true,
          notes: true,
          locations_order_detail_delivery_location_idTolocations: { select: { location_code: true, name: true } },
          order_detail_item_order_detail_item_detail_idToorder_detail: { select: { detail_name: true } },
          orders: { select: { order_number: true } },
          inventory_lots: { select: { storage_location_code: true } },
        },
      },
    },
  })

  const destinationCode = detail.destination_location ?? ''
  const appointmentTime = (detail.confirmed_start ?? detail.requested_start)
    ? formatDate(detail.confirmed_start ?? detail.requested_start, 'long')
    : '-'

  const sheetLines = lines
    .filter((l) => l.order_detail)
    .map((l) => {
      const od = serializeBigInt(l.order_detail!)
      const containerNumber = (od.orders && (od.orders as any).order_number) || ''
      const lineWithNotes = l as { load_sheet_notes?: string | null }
      // 柜号列：装车单第一列只显示柜号，不显示 -仓点
      // 仓储位置：入库管理明细行（inventory_lots）的仓库位置，如 B9/B10
      const lots = (od.inventory_lots as { storage_location_code?: string | null }[]) || []
      const storageCodes = [...new Set(lots.map((lot) => lot.storage_location_code).filter(Boolean))] as string[]
      const storageLocation = storageCodes.join('/')
      return {
        container_number: containerNumber,
        storage_location: storageLocation,
        load_sheet_notes: lineWithNotes.load_sheet_notes ?? null,
        planned_pallets: Number(l.estimated_pallets) || 0,
        loaded_pallets: '',
        remaining_pallets: '',
        is_clear: '',
      }
    })

  const totalPlannedPallets = sheetLines.reduce((sum, l) => sum + l.planned_pallets, 0)
  const logoDataUrl = await resolveLogoDataUrl()
  const data: OAKLoadSheetData = {
    destinationLabel: '卸货仓',
    destinationCode,
    trailer: detail.trailer_code ?? '',
    loadNumber: detail.reference_number ?? '',
    sealNumber: '',
    appointmentTime,
    delivery_address: detail.delivery_address ?? null,
    contact_name: detail.contact_name ?? null,
    contact_phone: detail.contact_phone ?? null,
    lines: sheetLines,
    totalPlannedPallets,
    totalIsClearLabel: detail.appointment_type ?? '',
    deliveryMethod: detail.delivery_method ?? null,
    logoDataUrl: logoDataUrl ?? undefined,
  }
  const pdfBuffer = await generateLoadingSheetPDF(data)
  const out = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as ArrayBuffer)
  const PDF_HEADER = Buffer.from('%PDF-')
  if (out.length < 100 || !out.subarray(0, 5).equals(PDF_HEADER)) return null
  return out
}

/** 批量装车单：2 次查询拉取全部数据，返回按 ids 顺序的 OAKLoadSheetData（不含 logo，由调用方统一加）。null 表示该 id 直送跳过。 */
export async function loadBatchLoadingSheetData(
  ids: string[]
): Promise<(OAKLoadSheetData | null)[]> {
  if (ids.length === 0) return []
  const idSet = ids.map((id) => BigInt(id))

  const [appointments, allLines] = await Promise.all([
    prisma.delivery_appointments.findMany({
      where: { appointment_id: { in: idSet } },
      include: {
        orders: { select: { status: true } },
        locations: { select: { location_code: true } },
        outbound_shipments: {
          select: {
            trailer_code: true,
            delivery_address: true,
            contact_name: true,
            contact_phone: true,
          },
        },
      },
    }),
    prisma.appointment_detail_lines.findMany({
      where: { appointment_id: { in: idSet } },
      include: {
        order_detail: {
          select: {
            id: true,
            order_id: true,
            estimated_pallets: true,
            remaining_pallets: true,
            delivery_nature: true,
            notes: true,
            locations_order_detail_delivery_location_idTolocations: { select: { location_code: true, name: true } },
            order_detail_item_order_detail_item_detail_idToorder_detail: { select: { detail_name: true } },
            orders: { select: { order_number: true } },
            inventory_lots: { select: { storage_location_code: true } },
          },
        },
      },
    }),
  ])

  const appointmentMap = new Map<string, (typeof appointments)[0]>()
  for (const a of appointments) {
    if (a.orders?.status !== 'direct_delivery') {
      appointmentMap.set(a.appointment_id.toString(), a)
    }
  }
  const linesByAppointment = new Map<string, typeof allLines>()
  for (const line of allLines) {
    const key = line.appointment_id.toString()
    if (!linesByAppointment.has(key)) linesByAppointment.set(key, [])
    linesByAppointment.get(key)!.push(line)
  }

  const result: (OAKLoadSheetData | null)[] = []
  for (const id of ids) {
    const appointment = appointmentMap.get(id)
    if (!appointment) {
      result.push(null)
      continue
    }
    const lines = linesByAppointment.get(id) ?? []
    const serializedApp = serializeBigInt(appointment)
    const destinationCode = (serializedApp.locations as any)?.location_code ?? ''
    const appointmentTime = (serializedApp.confirmed_start ?? serializedApp.requested_start)
      ? formatDate(serializedApp.confirmed_start ?? serializedApp.requested_start, 'long')
      : '-'
    const outbound = Array.isArray(serializedApp.outbound_shipments)
      ? serializedApp.outbound_shipments[0]
      : serializedApp.outbound_shipments
    const ob = outbound as { trailer_code?: string; delivery_address?: string | null; contact_name?: string | null; contact_phone?: string | null } | undefined
    const trailerCode = ob?.trailer_code ?? ''
    const sheetLines = lines
      .filter((l) => l.order_detail)
      .map((l) => {
        const od = serializeBigInt(l.order_detail!)
        const containerNumber = (od.orders && (od.orders as any).order_number) || ''
        const lineWithNotes = l as { load_sheet_notes?: string | null }
        const lots = (od.inventory_lots as { storage_location_code?: string | null }[]) || []
        const storageCodes = [...new Set(lots.map((lot) => lot.storage_location_code).filter(Boolean))] as string[]
        const storageLocation = storageCodes.join('/')
        return {
          container_number: containerNumber,
          storage_location: storageLocation,
          load_sheet_notes: lineWithNotes.load_sheet_notes ?? null,
          planned_pallets: Number(l.estimated_pallets) || 0,
          loaded_pallets: '',
          remaining_pallets: '',
          is_clear: '',
        }
      })
    const totalPlannedPallets = sheetLines.reduce((sum, l) => sum + l.planned_pallets, 0)
    result.push({
      destinationLabel: '卸货仓',
      destinationCode,
      trailer: trailerCode,
      loadNumber: serializedApp.reference_number ?? '',
      sealNumber: '',
      appointmentTime,
      delivery_address: ob?.delivery_address ?? null,
      contact_name: ob?.contact_name ?? null,
      contact_phone: ob?.contact_phone ?? null,
      lines: sheetLines,
      totalPlannedPallets,
      totalIsClearLabel: (serializedApp as any).appointment_type ?? '',
      deliveryMethod: (serializedApp as any).delivery_method ?? null,
      logoDataUrl: undefined,
    })
  }
  return result
}
