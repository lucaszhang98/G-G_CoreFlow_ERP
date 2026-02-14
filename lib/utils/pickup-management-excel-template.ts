/**
 * 提柜管理批量导入Excel模板生成器（双 Sheet）
 * Sheet1：MBL，柜号，码头/查验站，承运公司，ETA，LFD，提柜日期
 * Sheet2：提出，报空，还空，码头/查验站，码头位置，柜型，船司，柜号，提柜日期，LFD，MBL，司机，现在位置
 */

import * as ExcelJS from 'exceljs'

export interface PickupTemplateData {
  locations?: { location_code: string; name: string }[]
  carriers?: { name: string; carrier_code: string }[]
  drivers?: { driver_code: string }[]
}

const CURRENT_LOCATION_OPTIONS = [
  '空柜shipper',
  '空柜hw',
  '空柜forest',
  '空柜私仓',
  '满柜shipper',
  '满柜hw',
  '满柜forest',
  '满柜st',
]

const CONTAINER_TYPE_OPTIONS = ['40DH', '45DH', '40RH', '45RH', '20GP', '其他']

const BOOLEAN_OPTIONS = ['是', '否']

function applyHeaderStyle(sheet: ExcelJS.Worksheet, colCount: number, requiredKeys: string[], columns: { key: string; header: string }[]) {
  const headerRow = sheet.getRow(1)
  headerRow.height = 20
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: requiredKeys.includes(col.key) ? 'FFFF0000' : 'FF000000' },
    }
  })
}

/**
 * 生成提柜管理批量导入模板（两个 Sheet）
 */
export async function generatePickupManagementImportTemplate(
  templateData?: PickupTemplateData
): Promise<ExcelJS.Workbook> {
  const locations = templateData?.locations || []
  const carriers = templateData?.carriers || []
  const drivers = templateData?.drivers || []

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'G&G CoreFlow ERP'
  workbook.created = new Date()

  // ---------- Sheet 1：MBL，柜号，码头/查验站，承运公司，ETA，LFD，提柜日期 ----------
  const sheet1Cols: Array<{ key: string; header: string; width: number; required: boolean }> = [
    { key: 'mbl', header: 'MBL', width: 18, required: false },
    { key: 'container_number', header: '柜号', width: 18, required: true },
    { key: 'port_location_code', header: '码头/查验站', width: 15, required: false },
    { key: 'carrier_name', header: '承运公司', width: 15, required: false },
    { key: 'eta_date', header: 'ETA', width: 12, required: false },
    { key: 'lfd_date', header: 'LFD', width: 12, required: false },
    { key: 'pickup_date', header: '提柜日期', width: 16, required: false },
  ]

  const sheet1 = workbook.addWorksheet('提柜数据1', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })
  sheet1.columns = sheet1Cols.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }))
  applyHeaderStyle(sheet1, sheet1Cols.length, sheet1Cols.filter((c) => c.required).map((c) => c.key), sheet1Cols)

  const locationCodes = locations.map((l) => l.location_code).filter(Boolean).sort()
  const carrierNames = [
    ...new Set(carriers.map((c) => c.name).filter(Boolean)),
    ...carriers.map((c) => c.carrier_code).filter(Boolean),
  ].sort()

  const ROW_COUNT = 200
  for (let rowNum = 2; rowNum <= ROW_COUNT + 1; rowNum++) {
    const row = sheet1.getRow(rowNum)
    row.height = 18
    sheet1Cols.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      }
      if (['eta_date', 'lfd_date'].includes(col.key)) cell.numFmt = 'yyyy-mm-dd'
      if (col.key === 'pickup_date') cell.numFmt = 'yyyy-mm-dd hh:mm'
      if (col.key === 'port_location_code' && locationCodes.length > 0) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`码头查验站参考!$A$2:$A$${Math.min(locationCodes.length + 1, 1000)}`],
          showErrorMessage: true,
          errorTitle: '无效的码头/查验站',
          error: '请从下拉列表中选择有效的位置代码',
        }
      }
      if (col.key === 'carrier_name' && carrierNames.length > 0) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`承运公司参考!$A$2:$A$${Math.min(carrierNames.length + 1, 1000)}`],
          showErrorMessage: true,
          errorTitle: '无效的承运公司',
          error: '请从下拉列表中选择有效的承运公司',
        }
      }
      if (['eta_date', 'lfd_date', 'pickup_date'].includes(col.key)) {
        cell.dataValidation = {
          type: 'date',
          operator: 'between',
          formulae: [new Date('2020-01-01'), new Date('2099-12-31')],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: '无效的日期',
          error: '请使用日期格式（YYYY-MM-DD）或日期时间（提柜日期），日期需在 2020-01-01 至 2099-12-31 之间',
        }
      }
    })
  }

  // ---------- Sheet 2：提出，报空，还空，码头/查验站，码头位置，柜型，船司，柜号，提柜日期，LFD，MBL，司机，现在位置 ----------
  const sheet2Cols: Array<{ key: string; header: string; width: number; required: boolean }> = [
    { key: 'pickup_out', header: '提出', width: 8, required: false },
    { key: 'report_empty', header: '报空', width: 8, required: false },
    { key: 'return_empty', header: '还空', width: 8, required: false },
    { key: 'port_location_code', header: '码头/查验站', width: 15, required: false },
    { key: 'port_text', header: '码头位置', width: 12, required: false },
    { key: 'container_type', header: '柜型', width: 10, required: false },
    { key: 'shipping_line', header: '船司', width: 12, required: false },
    { key: 'container_number', header: '柜号', width: 18, required: true },
    { key: 'pickup_date', header: '提柜日期', width: 16, required: false },
    { key: 'lfd_date', header: 'LFD', width: 12, required: false },
    { key: 'mbl', header: 'MBL', width: 18, required: false },
    { key: 'driver_name', header: '司机', width: 12, required: false },
    { key: 'current_location', header: '现在位置', width: 14, required: false },
  ]

  const driverCodes = drivers.map((d) => d.driver_code).filter(Boolean).sort()

  const sheet2 = workbook.addWorksheet('提柜数据2', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })
  sheet2.columns = sheet2Cols.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }))
  applyHeaderStyle(sheet2, sheet2Cols.length, sheet2Cols.filter((c) => c.required).map((c) => c.key), sheet2Cols)

  for (let rowNum = 2; rowNum <= ROW_COUNT + 1; rowNum++) {
    const row = sheet2.getRow(rowNum)
    row.height = 18
    sheet2Cols.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      }
      if (['lfd_date'].includes(col.key)) cell.numFmt = 'yyyy-mm-dd'
      if (col.key === 'pickup_date') cell.numFmt = 'yyyy-mm-dd hh:mm'
      if (col.key === 'pickup_out' || col.key === 'report_empty' || col.key === 'return_empty') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${BOOLEAN_OPTIONS.join(',')}"`],
          showErrorMessage: true,
          errorTitle: '无效',
          error: '请选择：是、否',
        }
      }
      if (col.key === 'port_location_code' && locationCodes.length > 0) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`码头查验站参考!$A$2:$A$${Math.min(locationCodes.length + 1, 1000)}`],
          showErrorMessage: true,
          errorTitle: '无效的码头/查验站',
          error: '请从下拉列表中选择有效的位置代码',
        }
      }
      if (col.key === 'container_type') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${CONTAINER_TYPE_OPTIONS.join(',')}"`],
          showErrorMessage: true,
          errorTitle: '无效的柜型',
          error: `请从下拉列表中选择：${CONTAINER_TYPE_OPTIONS.join('、')}`,
        }
      }
      // 司机为文本框，不设下拉
      if (['pickup_date', 'lfd_date'].includes(col.key)) {
        cell.dataValidation = {
          type: 'date',
          operator: 'between',
          formulae: [new Date('2020-01-01'), new Date('2099-12-31')],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: '无效的日期',
          error: '请使用日期格式（YYYY-MM-DD）或日期时间（提柜日期），日期需在 2020-01-01 至 2099-12-31 之间',
        }
      }
      if (col.key === 'current_location') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${CURRENT_LOCATION_OPTIONS.join(',')}"`],
          showErrorMessage: true,
          errorTitle: '无效的现在位置',
          error: `请从下拉列表中选择：${CURRENT_LOCATION_OPTIONS.join('、')}`,
        }
      }
    })
  }

  // ---------- 填写说明 ----------
  const noteSheet = workbook.addWorksheet('填写说明', { state: 'hidden' })
  noteSheet.getCell('A1').value = '提柜管理批量导入说明（两个 Sheet）'
  noteSheet.getCell('A2').value = '1. 请在「提柜数据1」填写：MBL、柜号（必填）、码头/查验站、承运公司、ETA、LFD、提柜日期。'
  noteSheet.getCell('A3').value = '2. 请在「提柜数据2」填写：提出、报空、还空、码头/查验站、码头位置、柜型、船司、柜号（必填）、提柜日期、LFD、MBL、司机、现在位置。提出/报空/还空请填「是」或「否」。'
  noteSheet.getCell('A4').value = '3. 柜号用于匹配系统中已有订单；找不到对应订单时该行会报错。两个 Sheet 按柜号合并后更新，同一柜号可分别在两个 Sheet 中出现。'
  noteSheet.getCell('A5').value = '4. 日期：ETA、LFD 为日期（YYYY-MM-DD）；提柜日期可为日期时间（YYYY-MM-DD HH:mm）。'

  if (locationCodes.length > 0) {
    const locSheet = workbook.addWorksheet('码头查验站参考')
    locSheet.columns = [
      { header: '位置代码', key: 'code', width: 15 },
      { header: '位置名称', key: 'name', width: 30 },
    ]
    locations.forEach((l) => locSheet.addRow({ code: l.location_code, name: l.name }))
    locSheet.getRow(1).font = { bold: true }
    locSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
    locSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  if (carrierNames.length > 0) {
    const carSheet = workbook.addWorksheet('承运公司参考')
    carSheet.columns = [{ header: '承运公司（名称或代码）', key: 'name', width: 25 }]
    carrierNames.forEach((n) => carSheet.addRow({ name: n }))
    carSheet.getRow(1).font = { bold: true }
    carSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
    carSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  if (driverCodes.length > 0) {
    const drvSheet = workbook.addWorksheet('司机参考')
    drvSheet.columns = [{ header: '司机代码', key: 'code', width: 15 }]
    driverCodes.forEach((c) => drvSheet.addRow({ code: c }))
    drvSheet.getRow(1).font = { bold: true }
    drvSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
    drvSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  return workbook
}

/** 导出选中行所用：与导入模板一致的两表结构单行数据 */
export interface PickupExportRowForTemplate {
  mbl?: string | null
  container_number?: string | null
  port_location_code?: string | null
  carrier_name?: string | null
  eta_date?: Date | string | null
  lfd_date?: Date | string | null
  pickup_date?: Date | string | null
  pickup_out?: boolean
  report_empty?: boolean
  return_empty?: boolean
  port_text?: string | null
  container_type?: string | null
  shipping_line?: string | null
  driver_name?: string | null
  current_location?: string | null
}

function formatDateForExport(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

function formatDateTimeForExport(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  } catch {
    return ''
  }
}

function formatBooleanForExport(value: boolean | undefined): string {
  if (value === undefined) return ''
  return value ? '是' : '否'
}

/**
 * 按导入模板格式导出选中数据（两个 Sheet，列与导入模板一致）
 */
export async function generatePickupExportByTemplate(
  rows: PickupExportRowForTemplate[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'G&G CoreFlow ERP'
  workbook.created = new Date()

  const sheet1Cols: Array<{ key: string; header: string; width: number }> = [
    { key: 'mbl', header: 'MBL', width: 18 },
    { key: 'container_number', header: '柜号', width: 18 },
    { key: 'port_location_code', header: '码头/查验站', width: 15 },
    { key: 'carrier_name', header: '承运公司', width: 15 },
    { key: 'eta_date', header: 'ETA', width: 12 },
    { key: 'lfd_date', header: 'LFD', width: 12 },
    { key: 'pickup_date', header: '提柜日期', width: 16 },
  ]

  const sheet1 = workbook.addWorksheet('提柜数据1', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })
  sheet1.columns = sheet1Cols.map((c) => ({ key: c.key, header: c.header, width: c.width }))
  const header1 = sheet1.getRow(1)
  header1.height = 20
  header1.alignment = { horizontal: 'center', vertical: 'middle' }
  header1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
  header1.font = { bold: true, size: 11 }
  rows.forEach((r) => {
    sheet1.addRow({
      mbl: r.mbl ?? '',
      container_number: r.container_number ?? '',
      port_location_code: r.port_location_code ?? '',
      carrier_name: r.carrier_name ?? '',
      eta_date: formatDateForExport(r.eta_date),
      lfd_date: formatDateForExport(r.lfd_date),
      pickup_date: formatDateTimeForExport(r.pickup_date),
    })
  })

  const sheet2Cols: Array<{ key: string; header: string; width: number }> = [
    { key: 'pickup_out', header: '提出', width: 8 },
    { key: 'report_empty', header: '报空', width: 8 },
    { key: 'return_empty', header: '还空', width: 8 },
    { key: 'port_location_code', header: '码头/查验站', width: 15 },
    { key: 'port_text', header: '码头位置', width: 12 },
    { key: 'container_type', header: '柜型', width: 10 },
    { key: 'shipping_line', header: '船司', width: 12 },
    { key: 'container_number', header: '柜号', width: 18 },
    { key: 'pickup_date', header: '提柜日期', width: 16 },
    { key: 'lfd_date', header: 'LFD', width: 12 },
    { key: 'mbl', header: 'MBL', width: 18 },
    { key: 'driver_name', header: '司机', width: 12 },
    { key: 'current_location', header: '现在位置', width: 14 },
  ]

  const sheet2 = workbook.addWorksheet('提柜数据2', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })
  sheet2.columns = sheet2Cols.map((c) => ({ key: c.key, header: c.header, width: c.width }))
  const header2 = sheet2.getRow(1)
  header2.height = 20
  header2.alignment = { horizontal: 'center', vertical: 'middle' }
  header2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
  header2.font = { bold: true, size: 11 }
  rows.forEach((r) => {
    sheet2.addRow({
      pickup_out: formatBooleanForExport(r.pickup_out),
      report_empty: formatBooleanForExport(r.report_empty),
      return_empty: formatBooleanForExport(r.return_empty),
      port_location_code: r.port_location_code ?? '',
      port_text: r.port_text ?? '',
      container_type: r.container_type ?? '',
      shipping_line: r.shipping_line ?? '',
      container_number: r.container_number ?? '',
      pickup_date: formatDateTimeForExport(r.pickup_date),
      lfd_date: formatDateForExport(r.lfd_date),
      mbl: r.mbl ?? '',
      driver_name: r.driver_name ?? '',
      current_location: r.current_location ?? '',
    })
  })

  return workbook
}
