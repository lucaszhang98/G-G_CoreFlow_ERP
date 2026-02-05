/**
 * 提柜管理批量导入 Service（双 Sheet）
 * Sheet1：柜号，MBL，码头/查验站，承运公司，ETA，LFD，提柜日期
 * Sheet2：柜号，提出，报空，还空，码头/查验站，码头位置，柜型，船司，提柜日期，LFD，MBL，司机，现在位置
 * 按柜号合并后更新订单与提柜管理，不新建数据。
 */

import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import { ImportError } from './import/types'
import {
  pickupManagementSheet1RowSchema,
  pickupManagementSheet2RowSchema,
  type PickupManagementSheet1Row,
  type PickupManagementSheet2Row,
  type PickupManagementMergedRow,
} from '@/lib/validations/pickup-management-import'
import { calculateUnloadDate } from '@/lib/utils/calculate-unload-date'

const SHEET1_NAME = '提柜数据1'
const SHEET2_NAME = '提柜数据2'

const SHEET1_HEADER_MAP: Record<string, string> = {
  '柜号': 'container_number',
  'MBL': 'mbl',
  '码头/查验站': 'port_location_code',
  '承运公司': 'carrier_name',
  'ETA': 'eta_date',
  'LFD': 'lfd_date',
  '提柜日期': 'pickup_date',
}

const SHEET2_HEADER_MAP: Record<string, string> = {
  '柜号': 'container_number',
  '提出': 'pickup_out',
  '报空': 'report_empty',
  '还空': 'return_empty',
  '码头/查验站': 'port_location_code',
  '码头位置': 'port_text',
  '柜型': 'container_type',
  '船司': 'shipping_line',
  '提柜日期': 'pickup_date',
  'LFD': 'lfd_date',
  'MBL': 'mbl',
  '司机': 'driver_code',
  '现在位置': 'current_location',
}

interface PickupMasterData {
  orderByNumber: Map<string, { order_id: bigint }>
  carrierByName: Map<string, bigint>
  driverByCode: Map<string, bigint>
  locationByCode: Map<string, bigint>
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const dateFields = ['eta_date', 'lfd_date', 'pickup_date', 'return_deadline']
const dateTimeFields = ['pickup_date']

function parseDate(value: string | number | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      return new Date(EXCEL_EPOCH_UTC + Math.floor(value) * 86400000)
    }
    return null
  }
  const s = String(value).trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0, 0))
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseDateTime(value: string | number | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      return new Date(EXCEL_EPOCH_UTC + Math.round(value * 86400000))
    }
    return null
  }
  const s = String(value).trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?$/)
  if (m) {
    return new Date(
      Date.UTC(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
        parseInt(m[6] || '0', 10),
        parseInt((m[7] || '0').padEnd(3, '0').slice(0, 3), 10)
      )
    )
  }
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    return new Date(
      Date.UTC(
        parseInt(dateOnly[1], 10),
        parseInt(dateOnly[2], 10) - 1,
        parseInt(dateOnly[3], 10),
        0,
        0,
        0,
        0
      )
    )
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  const s = String(value).trim().toLowerCase()
  if (['是', 'true', 'y', 'yes', '1', '对'].includes(s)) return true
  if (['否', 'false', 'n', 'no', '0', '错'].includes(s)) return false
  return undefined
}

/** 将 Excel 行数组映射为对象（与 BaseImportService 行为一致） */
function mapRows(
  jsonData: any[],
  headerMap: Record<string, string>,
  sheetLabel: string
): { rows: any[]; errors: ImportError[] } {
  const errors: ImportError[] = []
  if (!jsonData || jsonData.length < 2) {
    return { rows: [], errors: [{ row: 0, field: 'file', message: `${sheetLabel}无表头或数据行` }] }
  }
  const headers = jsonData[0] as string[]
  const dataRows = jsonData.slice(1) as any[][]
  const rows: any[] = []
  let excelRowNum = 2
  for (const row of dataRows) {
    if (!row || !row.some((c: any) => c !== '' && c !== null && c !== undefined)) continue
    const obj: any = {}
    headers.forEach((header, index) => {
      const fieldName = headerMap[header?.trim?.() ?? header]
      if (!fieldName) return
      let cellValue = row[index]
      if (cellValue === null || cellValue === undefined || cellValue === '') {
        obj[fieldName] = ''
        return
      }
      if (cellValue instanceof Date) {
        if (isNaN(cellValue.getTime())) {
          obj[fieldName] = String(cellValue)
        } else {
          const y = cellValue.getFullYear()
          const m = String(cellValue.getMonth() + 1).padStart(2, '0')
          const d = String(cellValue.getDate()).padStart(2, '0')
          if (dateTimeFields.includes(fieldName) || (fieldName === 'pickup_date' && (cellValue.getHours() || cellValue.getMinutes()))) {
            obj[fieldName] = `${y}-${m}-${d} ${String(cellValue.getHours()).padStart(2, '0')}:${String(cellValue.getMinutes()).padStart(2, '0')}`
          } else {
            obj[fieldName] = `${y}-${m}-${d}`
          }
        }
        return
      }
      if (typeof cellValue === 'number') {
        if ((dateFields.includes(fieldName) || dateTimeFields.includes(fieldName)) && cellValue > 1000 && cellValue < 100000) {
          const date = new Date(EXCEL_EPOCH_UTC + cellValue * 86400000)
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          const d = String(date.getDate()).padStart(2, '0')
          if (dateTimeFields.includes(fieldName) || cellValue % 1 !== 0) {
            obj[fieldName] = `${y}-${m}-${d} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          } else {
            obj[fieldName] = `${y}-${m}-${d}`
          }
        } else {
          obj[fieldName] = String(cellValue)
        }
        return
      }
      if (fieldName === 'pickup_out' || fieldName === 'report_empty' || fieldName === 'return_empty') {
        const b = parseBoolean(cellValue)
        if (b !== undefined) obj[fieldName] = b
        else obj[fieldName] = String(cellValue)
        return
      }
      obj[fieldName] = String(cellValue)
    })
    rows.push(obj)
    excelRowNum++
  }
  return { rows, errors }
}

function validateRows<T>(
  rows: any[],
  schema: { safeParse: (r: any) => { success: boolean; data?: T; error?: any } },
  sheetLabel: string
): { validRows: T[]; errors: ImportError[] } {
  const validRows: T[] = []
  const errors: ImportError[] = []
  rows.forEach((row, i) => {
    const result = schema.safeParse(row)
    if (result.success && result.data) {
      validRows.push(result.data)
    } else {
      const first = result.error?.errors?.[0]
      errors.push({
        row: i + 2,
        field: first?.path?.[0]?.toString() ?? 'unknown',
        message: `${sheetLabel}第${i + 2}行：${first?.message ?? result.error?.message ?? '验证失败'}`,
      })
    }
  })
  return { validRows, errors }
}

function mergeByContainerNumber(
  sheet1: PickupManagementSheet1Row[],
  sheet2: PickupManagementSheet2Row[]
): PickupManagementMergedRow[] {
  const map = new Map<string, PickupManagementMergedRow>()
  for (const r of sheet1) {
    const key = r.container_number.trim()
    if (!key) continue
    map.set(key, {
      container_number: key,
      mbl: r.mbl,
      port_location_code: r.port_location_code,
      carrier_name: r.carrier_name,
      eta_date: r.eta_date,
      lfd_date: r.lfd_date,
      pickup_date: r.pickup_date,
    })
  }
  for (const r of sheet2) {
    const key = r.container_number.trim()
    if (!key) continue
    const existing = map.get(key) ?? { container_number: key }
    map.set(key, {
      ...existing,
      pickup_out: r.pickup_out,
      report_empty: r.report_empty,
      return_empty: r.return_empty,
      port_location_code: r.port_location_code ?? existing.port_location_code,
      port_text: r.port_text,
      container_type: r.container_type,
      shipping_line: r.shipping_line,
      pickup_date: r.pickup_date ?? existing.pickup_date,
      lfd_date: r.lfd_date ?? existing.lfd_date,
      mbl: r.mbl ?? existing.mbl,
      driver_code: r.driver_code,
      current_location: r.current_location,
    })
  }
  return Array.from(map.values())
}

export interface PickupImportResult {
  success: boolean
  imported?: number
  total?: number
  errors?: ImportError[]
}

async function loadMasterData(): Promise<PickupMasterData> {
  const [orders, carriers, drivers, locations] = await Promise.all([
    prisma.orders.findMany({ select: { order_id: true, order_number: true } }),
    prisma.carriers.findMany({ select: { carrier_id: true, name: true, carrier_code: true } }),
    prisma.drivers.findMany({ select: { driver_id: true, driver_code: true } }),
    prisma.locations.findMany({
      where: { location_type: 'port' },
      select: { location_id: true, location_code: true, name: true },
    }),
  ])
  const orderByNumber = new Map(orders.map((o) => [o.order_number, { order_id: o.order_id }]))
  const carrierByName = new Map<string, bigint>()
  carriers.forEach((c) => {
    if (c.name) carrierByName.set(c.name.trim(), c.carrier_id)
    if (c.carrier_code) carrierByName.set(c.carrier_code.trim(), c.carrier_id)
  })
  const driverByCode = new Map(drivers.map((d) => [d.driver_code?.trim() || '', d.driver_id]))
  const locationByCode = new Map(
    locations.map((l) => [l.location_code?.trim() || l.name?.trim() || '', l.location_id])
  )
  return { orderByNumber, carrierByName, driverByCode, locationByCode }
}

function checkDuplicates(merged: PickupManagementMergedRow[], master: PickupMasterData): ImportError[] {
  const errors: ImportError[] = []
  merged.forEach((row, i) => {
    const order = master.orderByNumber.get(row.container_number)
    if (!order) {
      errors.push({
        row: i + 2,
        field: '柜号',
        message: `未找到柜号对应的订单："${row.container_number}"，导入仅支持更新已有订单`,
      })
    }
  })
  return errors
}

async function executeImport(
  data: PickupManagementMergedRow[],
  userId: bigint,
  masterData: PickupMasterData
): Promise<number> {
  let successCount = 0
  for (const row of data) {
    const orderInfo = masterData.orderByNumber.get(row.container_number)
    if (!orderInfo) continue
    const orderId = orderInfo.order_id

    const orderUpdate: any = { updated_by: userId, updated_at: new Date() }
    if (row.mbl !== undefined) orderUpdate.mbl_number = row.mbl || null
    if (row.port_location_code !== undefined) {
      orderUpdate.port_location_id = masterData.locationByCode.get(row.port_location_code) ?? null
    }
    if (row.container_type !== undefined) orderUpdate.container_type = row.container_type || null
    if (row.eta_date !== undefined) orderUpdate.eta_date = parseDate(row.eta_date)
    if (row.lfd_date !== undefined) orderUpdate.lfd_date = parseDate(row.lfd_date)
    if (row.pickup_date !== undefined) orderUpdate.pickup_date = parseDateTime(row.pickup_date)
    if (row.carrier_name !== undefined) {
      orderUpdate.carrier_id = masterData.carrierByName.get(row.carrier_name) ?? null
    }

    const pickupUpdate: any = { updated_by: userId, updated_at: new Date() }
    if (row.port_text !== undefined) pickupUpdate.port_text = row.port_text || null
    if (row.shipping_line !== undefined) pickupUpdate.shipping_line = row.shipping_line || null
    if (row.driver_code !== undefined) {
      pickupUpdate.driver_id = masterData.driverByCode.get(row.driver_code) ?? null
    }
    if (row.current_location !== undefined) pickupUpdate.current_location = row.current_location || null
    if (row.pickup_out !== undefined) pickupUpdate.pickup_out = row.pickup_out
    if (row.report_empty !== undefined) pickupUpdate.report_empty = row.report_empty
    if (row.return_empty !== undefined) pickupUpdate.return_empty = row.return_empty

    const existingPickup = await prisma.pickup_management.findUnique({
      where: { order_id: orderId },
      select: { pickup_id: true },
    })

    await prisma.$transaction(async (tx) => {
      if (Object.keys(orderUpdate).length > 2) {
        await tx.orders.update({ where: { order_id: orderId }, data: orderUpdate })
      }
      if (existingPickup && Object.keys(pickupUpdate).length > 2) {
        await tx.pickup_management.update({
          where: { pickup_id: existingPickup.pickup_id },
          data: pickupUpdate,
        })
      }
    })

    if (orderUpdate.pickup_date !== undefined || orderUpdate.eta_date !== undefined) {
      const updatedOrder = await prisma.orders.findUnique({
        where: { order_id: orderId },
        select: { pickup_date: true, eta_date: true },
      })
      if (updatedOrder) {
        const calculatedUnloadDate = calculateUnloadDate(
          updatedOrder.pickup_date,
          updatedOrder.eta_date
        )
        const inbound = await prisma.inbound_receipt.findUnique({
          where: { order_id: orderId },
          select: { inbound_receipt_id: true },
        })
        if (inbound && calculatedUnloadDate) {
          await prisma.inbound_receipt.update({
            where: { inbound_receipt_id: inbound.inbound_receipt_id },
            data: {
              planned_unload_at: calculatedUnloadDate,
              updated_by: userId,
              updated_at: new Date(),
            },
          })
        }
      }
    }
    successCount++
  }
  return successCount
}

export const pickupManagementImportService = {
  async import(file: File, userId: bigint): Promise<PickupImportResult> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetNames = workbook.SheetNames || []

    const sheet1Name = sheetNames.find((n) => n === SHEET1_NAME || n.trim() === SHEET1_NAME)
    const sheet2Name = sheetNames.find((n) => n === SHEET2_NAME || n.trim() === SHEET2_NAME)
    if (!sheet1Name || !sheet2Name) {
      return {
        success: false,
        errors: [
          {
            row: 0,
            field: 'file',
            message: `Excel 必须包含两个工作表：「${SHEET1_NAME}」和「${SHEET2_NAME}」`,
          },
        ],
      }
    }

    const json1 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet1Name!], { header: 1, defval: '' }) as any[]
    const json2 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet2Name!], { header: 1, defval: '' }) as any[]

    const { rows: mapped1, errors: mapErr1 } = mapRows(json1, SHEET1_HEADER_MAP, SHEET1_NAME)
    const { rows: mapped2, errors: mapErr2 } = mapRows(json2, SHEET2_HEADER_MAP, SHEET2_NAME)
    if (mapErr1.length) return { success: false, errors: mapErr1 }
    if (mapErr2.length) return { success: false, errors: mapErr2 }

    const { validRows: valid1, errors: err1 } = validateRows(
      mapped1,
      pickupManagementSheet1RowSchema,
      SHEET1_NAME
    )
    const { validRows: valid2, errors: err2 } = validateRows(
      mapped2,
      pickupManagementSheet2RowSchema,
      SHEET2_NAME
    )
    const allErrors = [...err1, ...err2]
    if (allErrors.length > 0) {
      return { success: false, total: valid1.length + valid2.length, errors: allErrors.slice(0, 20) }
    }

    const merged = mergeByContainerNumber(valid1, valid2)
    if (merged.length === 0) {
      return {
        success: false,
        errors: [{ row: 0, field: 'file', message: '合并后没有有效的柜号数据' }],
      }
    }

    const masterData = await loadMasterData()
    const dupErrors = checkDuplicates(merged, masterData)
    if (dupErrors.length > 0) {
      return { success: false, total: merged.length, errors: dupErrors.slice(0, 20) }
    }

    const successCount = await executeImport(merged, userId, masterData)
    return { success: true, imported: successCount, total: merged.length }
  },
}
