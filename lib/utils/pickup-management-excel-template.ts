/**
 * 提柜管理批量导入Excel模板生成器
 * 仅包含柜号（匹配用）+ 可修改字段，全部选填除柜号；单元格带下拉框与系统规则一致
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

/**
 * 生成提柜管理批量导入模板
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

  const sheet = workbook.addWorksheet('提柜数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  const columns: Array<{ key: string; header: string; width: number; required: boolean }> = [
    { key: 'container_number', header: '柜号', width: 18, required: true },
    { key: 'mbl', header: 'MBL', width: 18, required: false },
    { key: 'port_location_code', header: '码头/查验站', width: 15, required: false },
    { key: 'port_text', header: '码头位置', width: 12, required: false },
    { key: 'shipping_line', header: '船司', width: 12, required: false },
    { key: 'container_type', header: '柜型', width: 10, required: false },
    { key: 'carrier_name', header: '承运公司', width: 15, required: false },
    { key: 'driver_code', header: '司机', width: 12, required: false },
    { key: 'eta_date', header: 'ETA', width: 12, required: false },
    { key: 'lfd_date', header: 'LFD', width: 12, required: false },
    { key: 'pickup_date', header: '提柜日期', width: 16, required: false },
    { key: 'return_deadline', header: '还柜日期', width: 12, required: false },
    { key: 'current_location', header: '现在位置', width: 14, required: false },
  ]

  sheet.columns = columns.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }))

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
      color: { argb: col.required ? 'FFFF0000' : 'FF000000' },
    }
  })

  const locationCodes = locations.map((l) => l.location_code).filter(Boolean).sort()
  const carrierNames = [
    ...new Set(carriers.map((c) => c.name).filter(Boolean)),
    ...carriers.map((c) => c.carrier_code).filter(Boolean),
  ].sort()
  const driverCodes = drivers.map((d) => d.driver_code).filter(Boolean).sort()

  const ROW_COUNT = 200
  for (let rowNum = 2; rowNum <= ROW_COUNT + 1; rowNum++) {
    const row = sheet.getRow(rowNum)
    row.height = 18

    columns.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      }

      if (['eta_date', 'lfd_date', 'return_deadline'].includes(col.key)) {
        cell.numFmt = 'yyyy-mm-dd'
      }
      if (col.key === 'pickup_date') {
        cell.numFmt = 'yyyy-mm-dd hh:mm'
      }

      switch (col.key) {
        case 'port_location_code':
          if (locationCodes.length > 0) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`码头查验站参考!$A$2:$A$${Math.min(locationCodes.length + 1, 1000)}`],
              showErrorMessage: true,
              errorTitle: '无效的码头/查验站',
              error: '请从下拉列表中选择有效的位置代码',
            }
          }
          break
        case 'container_type':
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${CONTAINER_TYPE_OPTIONS.join(',')}"`],
            showErrorMessage: true,
            errorTitle: '无效的柜型',
            error: `请从下拉列表中选择：${CONTAINER_TYPE_OPTIONS.join('、')}`,
          }
          break
        case 'carrier_name':
          if (carrierNames.length > 0) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`承运公司参考!$A$2:$A$${Math.min(carrierNames.length + 1, 1000)}`],
              showErrorMessage: true,
              errorTitle: '无效的承运公司',
              error: '请从下拉列表中选择有效的承运公司',
            }
          }
          break
        case 'driver_code':
          if (driverCodes.length > 0) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`司机参考!$A$2:$A$${Math.min(driverCodes.length + 1, 1000)}`],
              showErrorMessage: true,
              errorTitle: '无效的司机',
              error: '请从下拉列表中选择有效的司机代码',
            }
          }
          break
        case 'eta_date':
        case 'lfd_date':
        case 'return_deadline':
          cell.dataValidation = {
            type: 'date',
            operator: 'between',
            formulae: [new Date('2020-01-01'), new Date('2099-12-31')],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: '无效的日期',
            error: '请使用日期格式（YYYY-MM-DD）或点击单元格使用日期选择器，日期需在 2020-01-01 至 2099-12-31 之间',
          }
          break
        case 'pickup_date':
          cell.dataValidation = {
            type: 'date',
            operator: 'between',
            formulae: [new Date('2020-01-01'), new Date('2099-12-31')],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: '无效的日期时间',
            error: '请使用日期时间格式（YYYY-MM-DD HH:mm）或点击单元格选择日期和时间，需在 2020-01-01 至 2099-12-31 之间',
          }
          break
        case 'current_location':
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${CURRENT_LOCATION_OPTIONS.join(',')}"`],
            showErrorMessage: true,
            errorTitle: '无效的现在位置',
            error: `请从下拉列表中选择：${CURRENT_LOCATION_OPTIONS.join('、')}`,
          }
          break
      }
    })
  }

  const noteSheet = workbook.addWorksheet('填写说明', { state: 'hidden' })
  noteSheet.getCell('A1').value = '提柜管理批量导入说明'
  noteSheet.getCell('A2').value = '1. 柜号为必填项，用于匹配系统中已有订单；找不到对应订单时该行会报错，不会新建任何数据。'
  noteSheet.getCell('A3').value = '2. 除柜号外所有字段均为选填，仅更新您填写的字段。'
  noteSheet.getCell('A4').value = '3. 码头/查验站、承运公司、司机、柜型、现在位置请从下拉列表选择。'
  noteSheet.getCell('A5').value = '4. 日期/时间校验：ETA、LFD、还柜日期为日期（YYYY-MM-DD）；提柜日期为日期时间（YYYY-MM-DD HH:mm）。日期需在 2020-01-01 至 2099-12-31 之间，请使用单元格日期选择器或正确格式输入。'

  if (locationCodes.length > 0) {
    const locSheet = workbook.addWorksheet('码头查验站参考')
    locSheet.columns = [
      { header: '位置代码', key: 'code', width: 15 },
      { header: '位置名称', key: 'name', width: 30 },
    ]
    locations.forEach((l) => locSheet.addRow({ code: l.location_code, name: l.name }))
    locSheet.getRow(1).font = { bold: true }
    locSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    }
    locSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  if (carrierNames.length > 0) {
    const carSheet = workbook.addWorksheet('承运公司参考')
    carSheet.columns = [{ header: '承运公司（名称或代码）', key: 'name', width: 25 }]
    carrierNames.forEach((n) => carSheet.addRow({ name: n }))
    carSheet.getRow(1).font = { bold: true }
    carSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    }
    carSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  if (driverCodes.length > 0) {
    const drvSheet = workbook.addWorksheet('司机参考')
    drvSheet.columns = [{ header: '司机代码', key: 'code', width: 15 }]
    driverCodes.forEach((c) => drvSheet.addRow({ code: c }))
    drvSheet.getRow(1).font = { bold: true }
    drvSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    }
    drvSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  }

  return workbook
}
