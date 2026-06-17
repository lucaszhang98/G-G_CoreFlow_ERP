/**
 * 费用批量导入 Excel 模板生成
 */

import ExcelJS from 'exceljs'
import type { CustomerFeeImportTemplateRow } from '@/lib/finance/customer-fee-import-template'

export type FeeImportTemplateData = {
  customer?: { code: string; name: string }
  rows?: CustomerFeeImportTemplateRow[]
}

const CUSTOMER_COLUMNS = [
  { key: 'customer_code', header: '客户代码', width: 14 },
  { key: 'fee_id', header: '费用ID', width: 12 },
  { key: 'fee_code', header: '费用编码', width: 18 },
  { key: 'fee_name', header: '费用名称', width: 18 },
  { key: 'unit', header: '单位', width: 12 },
  { key: 'unit_price', header: '单价', width: 12 },
  { key: 'currency', header: '币种', width: 10 },
  { key: 'scope_type', header: '归属范围', width: 14 },
  { key: 'container_type', header: '柜型', width: 12 },
  { key: 'description', header: '说明', width: 28 },
] as const

function styleHeaderRow(sheet: ExcelJS.Worksheet, colCount: number) {
  const headerRow = sheet.getRow(1)
  for (let i = 1; i <= colCount; i++) {
    const cell = headerRow.getCell(i)
    cell.font = { bold: true, size: 11 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
}

function addInstructionSheets(
  workbook: ExcelJS.Workbook,
  opts: { customerMode: boolean; customerLabel?: string }
) {
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 14 },
    { header: '是否必填', width: 10 },
    { header: '格式要求', width: 50 },
    { header: '示例', width: 24 },
  ]
  styleHeaderRow(instructionSheet, 4)

  const instructions = opts.customerMode
    ? [
        ['客户代码', '是', '与下载时选择的客户一致，勿修改', opts.customerLabel ?? 'OAK001'],
        ['费用ID', '否', '系统内部 ID；已有客户费用行会预填，新增行留空', '12345'],
        ['费用编码', '是', '必填，同一费用类型使用相同编码', 'STORAGE'],
        ['费用名称', '是', '必填，显示名称', '仓储费'],
        ['单位', '否', '如 板/箱/票', '板'],
        ['单价', '是', '数字，不能为负', '100'],
        ['币种', '否', '默认 USD', 'USD'],
        ['归属范围', '是', '客户费用表固定填 customers', 'customers'],
        ['柜型', '否', '选填，如 20GP/40DH，空表示不限柜型', '20GP'],
        ['说明', '否', '选填', ''],
      ]
    : [
        ['费用编码', '是', '必填，同一费用类型使用相同编码', 'STORAGE, HANDLING'],
        ['费用名称', '是', '必填，显示名称', '仓储费, 操作费'],
        ['单位', '否', '如 板/箱/票', '板'],
        ['单价', '是', '数字，不能为负', '100'],
        ['币种', '否', '默认 USD', 'USD'],
        ['归属范围', '是', 'all=所有客户，customers=指定客户', 'all 或 customers'],
        ['柜型', '否', '选填，如 20GP/40DH，空表示不限柜型', '20GP'],
        ['说明', '否', '选填', '默认仓储费'],
      ]

  instructions.forEach((row, idx) => {
    const r = instructionSheet.getRow(idx + 2)
    row.forEach((val, colIdx) => {
      r.getCell(colIdx + 1).value = val
    })
  })

  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = opts.customerMode
    ? '客户费用批量导入须知'
    : '费用批量导入须知'
  noteSheet.getCell('A1').font = {
    bold: true,
    size: 14,
    color: { argb: 'FFFF0000' },
  }
  const notes = opts.customerMode
    ? [
        '',
        `1. 本表为客户「${opts.customerLabel ?? ''}」的完整费用清单，可直接改单价后上传。`,
        '2. 必填：客户代码、费用编码、费用名称、单价、归属范围（customers）。',
        '3. 有「费用ID」的行会更新对应记录；无 ID 的行按客户+编码+柜型新建客户专属费用。',
        '4. 请勿修改客户代码；勿删除费用编码/柜型组合以免匹配失败。',
        '5. 导入采用「全部成功或全部失败」。',
        '6. 强烈建议使用「选择性粘贴→值」粘贴数据。',
      ]
    : [
        '',
        '1. 必填：费用编码、费用名称、单价、归属范围。',
        '2. 归属范围：all = 所有客户（默认价），customers = 指定客户。',
        '3. 导入采用「全部成功或全部失败」。',
        '4. 强烈建议使用「选择性粘贴→值」粘贴数据。',
      ]
  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })
}

export async function generateFeeImportTemplate(
  templateData?: FeeImportTemplateData
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const customerMode = Boolean(templateData?.customer && templateData?.rows)

  const dataSheet = workbook.addWorksheet('费用数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  if (customerMode && templateData?.rows) {
    dataSheet.columns = CUSTOMER_COLUMNS.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width,
    }))
    styleHeaderRow(dataSheet, CUSTOMER_COLUMNS.length)

    templateData.rows.forEach((row, idx) => {
      const r = dataSheet.getRow(idx + 2)
      r.getCell(1).value = row.customer_code
      r.getCell(2).value = row.fee_id ?? ''
      r.getCell(3).value = row.fee_code
      r.getCell(4).value = row.fee_name
      r.getCell(5).value = row.unit ?? ''
      r.getCell(6).value = row.unit_price
      r.getCell(7).value = row.currency
      r.getCell(8).value = row.scope_type
      r.getCell(9).value = row.container_type ?? ''
      r.getCell(10).value = row.description ?? ''
    })

    const scopeCol = 'H'
    const lastRow = Math.max(templateData.rows.length + 50, 201)
    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      dataSheet.getCell(`${scopeCol}${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"customers"'],
        showErrorMessage: true,
        errorTitle: '无效输入',
        error: '客户费用表归属范围请填写 customers',
      }
    }

    addInstructionSheets(workbook, {
      customerMode: true,
      customerLabel: `${templateData.customer!.code}（${templateData.customer!.name}）`,
    })
    return workbook
  }

  const columns = [
    { key: 'fee_code', header: '费用编码', width: 18 },
    { key: 'fee_name', header: '费用名称', width: 18 },
    { key: 'unit', header: '单位', width: 12 },
    { key: 'unit_price', header: '单价', width: 12 },
    { key: 'currency', header: '币种', width: 10 },
    { key: 'scope_type', header: '归属范围', width: 14 },
    { key: 'container_type', header: '柜型', width: 12 },
    { key: 'description', header: '说明', width: 28 },
  ]

  dataSheet.columns = columns.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }))
  styleHeaderRow(dataSheet, columns.length)

  for (let rowNum = 2; rowNum <= 201; rowNum++) {
    dataSheet.getCell(`F${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"all,customers"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      error: '请填写 all（所有客户）或 customers（指定客户）',
    }
  }

  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'STORAGE'
  exampleRow.getCell(2).value = '仓储费'
  exampleRow.getCell(3).value = '板'
  exampleRow.getCell(4).value = 100
  exampleRow.getCell(5).value = 'USD'
  exampleRow.getCell(6).value = 'all'
  exampleRow.getCell(7).value = '20GP'
  exampleRow.getCell(8).value = '默认仓储费'

  addInstructionSheets(workbook, { customerMode: false })
  return workbook
}

export async function downloadFeeExcelFile(
  workbook: ExcelJS.Workbook,
  filename: string = '费用导入模板.xlsx'
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
