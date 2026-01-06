/**
 * 司机导入Excel模板生成
 */

import ExcelJS from 'exceljs'

export async function generateDriverImportTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  
  const dataSheet = workbook.addWorksheet('司机数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  })

  const columns = [
    // 必填字段
    { key: 'driver_code', header: '司机代码', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'license_number', header: '驾驶证号', width: 20, required: true, hidden: false, outlineLevel: 0 },
    { key: 'license_plate', header: '车牌号', width: 12, required: true, hidden: false, outlineLevel: 0 },
    
    // 选填字段（默认隐藏）
    { key: 'carrier_code', header: '承运商代码', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_name', header: '联系人姓名', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_phone', header: '联系电话', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_email', header: '联系邮箱', width: 25, required: false, hidden: true, outlineLevel: 1 },
    { key: 'license_expiration', header: '驾驶证到期日', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'status', header: '状态', width: 12, required: false, hidden: true, outlineLevel: 1 },
    { key: 'notes', header: '备注', width: 30, required: false, hidden: true, outlineLevel: 1 },
  ]

  // 设置列属性，包括折叠功能
  dataSheet.columns = columns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width,
    hidden: col.hidden || false,
    outlineLevel: col.outlineLevel || 0
  }))

  // 设置表头样式
  const headerRow = dataSheet.getRow(1)
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.font = {
      bold: true,
      color: { argb: col.required ? 'FFFF0000' : 'FF000000' },
      size: 11
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // 预填200行
  for (let rowNum = 2; rowNum <= 201; rowNum++) {
    // 状态：下拉列表
    dataSheet.getCell(`I${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"active,inactive"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      errorStyle: 'error',
      error: '请从下拉列表中选择状态'
    }
    
    // 日期格式
    dataSheet.getCell(`H${rowNum}`).numFmt = 'yyyy-mm-dd'
  }

  // 示例数据
  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'DRV-001'
  exampleRow.getCell(2).value = '123456789012345678'
  exampleRow.getCell(3).value = 'ABC1234'
  exampleRow.getCell(4).value = 'CVT'
  exampleRow.getCell(5).value = '张三'
  exampleRow.getCell(6).value = '13800138000'
  exampleRow.getCell(7).value = 'zhangsan@example.com'
  exampleRow.getCell(8).value = '2026-12-31'
  exampleRow.getCell(9).value = 'active'
  exampleRow.getCell(10).value = '经验丰富的司机'

  // 字段说明
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 18 },
    { header: '是否必填', width: 12 },
    { header: '格式要求', width: 60 },
    { header: '示例', width: 25 }
  ]

  const instrHeaderRow = instructionSheet.getRow(1)
  instrHeaderRow.font = { bold: true }
  instrHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  const instructions = [
    ['司机代码', '是', '必填，最多50个字符，建议使用易识别的代码', 'DRV-001, DRIVER-002'],
    ['驾驶证号', '是', '必填，最多100个字符', '123456789012345678'],
    ['车牌号', '是', '必填，最多10个字符', 'ABC1234, 京A12345'],
    ['承运商代码', '否', '选填，必须是系统中已存在的承运商代码', 'CVT, CARRIER-001'],
    ['联系人姓名', '否', '选填，最多100个字符', '张三, John Smith'],
    ['联系电话', '否', '选填，最多50个字符', '13800138000, +1-555-1234'],
    ['联系邮箱', '否', '选填，必须是有效的邮箱格式', 'zhangsan@example.com'],
    ['驾驶证到期日', '否', '选填，格式必须是 YYYY-MM-DD', '2026-12-31'],
    ['状态', '否', '选填，只能是：active（可用）、inactive（停用）', 'active'],
    ['备注', '否', '选填，任意文本', '经验丰富的司机'],
  ]

  instructions.forEach((row, index) => {
    const excelRow = instructionSheet.getRow(index + 2)
    row.forEach((value, colIndex) => {
      excelRow.getCell(colIndex + 1).value = value
    })
  })

  // 导入须知
  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = '司机批量导入须知'
  noteSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }
  
  const notes = [
    '',
    '1. 必填字段（红色表头）：司机代码、驾驶证号、车牌号',
    '2. 司机代码必须唯一，不能与系统中已有的司机代码重复',
    '3. 承运商代码必须是系统中已存在的承运商代码',
    '4. 联系邮箱必须是有效的邮箱格式（如：user@example.com）',
    '5. 驾驶证到期日格式必须是 YYYY-MM-DD（如：2026-12-31）',
    '6. 状态只能是：active（可用）、inactive（停用），默认为 active',
    '7. 导入采用"全部成功或全部失败"模式',
    '8. 选填字段默认隐藏，点击Excel中列标题左侧的"+"号可以展开',
    '9. 强烈建议使用"选择性粘贴→值"来粘贴数据',
    '   Windows: Ctrl+Alt+V，然后选择"值"',
    '   或右键 → 选择性粘贴 → 值',
    '10. 第2行为示例数据，可以参考后删除或覆盖',
    '11. 已预填200行标准格式',
  ]

  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })

  return workbook
}

export async function downloadDriverExcelFile(workbook: ExcelJS.Workbook, filename: string = '司机导入模板.xlsx') {
  try {
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载Excel文件失败:', error)
    throw error
  }
}

