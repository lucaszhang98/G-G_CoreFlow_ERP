/**
 * 费用批量导入 Excel 模板生成
 */

import ExcelJS from 'exceljs'

export async function generateFeeImportTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()

  const dataSheet = workbook.addWorksheet('费用数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  const columns = [
    { key: 'fee_code', header: '费用编码', width: 18 },
    { key: 'fee_name', header: '费用名称', width: 18 },
    { key: 'unit', header: '单位', width: 12 },
    { key: 'unit_price', header: '单价', width: 12 },
    { key: 'currency', header: '币种', width: 10 },
    { key: 'scope_type', header: '归属范围', width: 14 },
    { key: 'description', header: '说明', width: 28 },
    { key: 'sort_order', header: '排序', width: 8 },
    { key: 'is_active', header: '启用', width: 10 },
  ]

  dataSheet.columns = columns.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
  }))

  const headerRow = dataSheet.getRow(1)
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.font = { bold: true, size: 11 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // 归属范围下拉
  for (let rowNum = 2; rowNum <= 201; rowNum++) {
    dataSheet.getCell(`F${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"all,customers"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      error: '请填写 all（所有客户）或 customers（指定客户）',
    }
    dataSheet.getCell(`I${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"是,否"'],
      showErrorMessage: true,
      error: '请填写 是 或 否',
    }
  }

  // 示例行
  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'STORAGE'
  exampleRow.getCell(2).value = '仓储费'
  exampleRow.getCell(3).value = '板'
  exampleRow.getCell(4).value = 100
  exampleRow.getCell(5).value = 'USD'
  exampleRow.getCell(6).value = 'all'
  exampleRow.getCell(7).value = '默认仓储费'
  exampleRow.getCell(8).value = 0
  exampleRow.getCell(9).value = '是'

  // 字段说明
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 14 },
    { header: '是否必填', width: 10 },
    { header: '格式要求', width: 50 },
    { header: '示例', width: 24 },
  ]
  const instrHeaderRow = instructionSheet.getRow(1)
  instrHeaderRow.font = { bold: true }
  instrHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }
  const instructions = [
    ['费用编码', '是', '必填，同一费用类型使用相同编码', 'STORAGE, HANDLING'],
    ['费用名称', '是', '必填，显示名称', '仓储费, 操作费'],
    ['单位', '否', '如 板/箱/票', '板'],
    ['单价', '是', '数字，不能为负', '100'],
    ['币种', '否', '默认 USD', 'USD'],
    ['归属范围', '是', 'all=所有客户，customers=指定客户', 'all 或 customers'],
    ['说明', '否', '选填', '默认仓储费'],
    ['排序', '否', '数字，默认 0', '0'],
    ['启用', '否', '是/否，默认 是', '是'],
  ]
  instructions.forEach((row, idx) => {
    const r = instructionSheet.getRow(idx + 2)
    row.forEach((val, colIdx) => {
      r.getCell(colIdx + 1).value = val
    })
  })

  // 导入须知
  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = '费用批量导入须知'
  noteSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }
  const notes = [
    '',
    '1. 必填：费用编码、费用名称、单价、归属范围。',
    '2. 归属范围：all = 所有客户（默认价），customers = 指定客户（需在详情页维护客户范围）。',
    '3. 同一费用编码建议先有一条 scope_type=all 的默认价，再按需添加 scope_type=customers 的变体。',
    '4. 导入采用「全部成功或全部失败」。',
    '5. 强烈建议使用「选择性粘贴→值」粘贴数据。',
  ]
  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })

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
