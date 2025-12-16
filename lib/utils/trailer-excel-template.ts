/**
 * 货柜导入Excel模板生成
 */

import ExcelJS from 'exceljs'

export async function generateTrailerImportTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  
  const dataSheet = workbook.addWorksheet('货柜数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  })

  const columns = [
    // 必填字段
    { key: 'trailer_code', header: '货柜代码', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'trailer_type', header: '货柜类型', width: 15, required: true, hidden: false, outlineLevel: 0 },
    
    // 选填字段（默认隐藏）
    { key: 'length_feet', header: '长度(英尺)', width: 12, required: false, hidden: true, outlineLevel: 1 },
    { key: 'capacity_weight', header: '载重(磅)', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'capacity_volume', header: '容量(立方英尺)', width: 18, required: false, hidden: true, outlineLevel: 1 },
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
    dataSheet.getCell(`F${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"available,in_use,maintenance,retired"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      errorStyle: 'error',
      error: '请从下拉列表中选择状态'
    }
    
    // 数字格式
    dataSheet.getCell(`C${rowNum}`).numFmt = '0.00'
    dataSheet.getCell(`D${rowNum}`).numFmt = '#,##0.00'
    dataSheet.getCell(`E${rowNum}`).numFmt = '#,##0.00'
  }

  // 示例数据 - 使用美国标准货柜
  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'TRL-53-001'
  exampleRow.getCell(2).value = '53ft Dry Van'
  exampleRow.getCell(3).value = 53
  exampleRow.getCell(4).value = 45000
  exampleRow.getCell(5).value = 3800
  exampleRow.getCell(6).value = 'available'
  exampleRow.getCell(7).value = 'Regular maintenance, DOT compliant'

  // 字段说明
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 18 },
    { header: '是否必填', width: 12 },
    { header: '格式要求', width: 60 },
    { header: '示例', width: 20 }
  ]

  const instrHeaderRow = instructionSheet.getRow(1)
  instrHeaderRow.font = { bold: true }
  instrHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  const instructions = [
    ['货柜代码', '是', '必填，最多50个字符，建议使用易识别的代码', 'TRL-53-001, CNT-40-HC-002'],
    ['货柜类型', '是', '必填，最多50个字符，例如：53ft Dry Van, 40ft Container, 20ft Container', '53ft Dry Van, 40ft High Cube'],
    ['长度(英尺)', '否', '选填，必须是大于0的数字', '53, 40, 20'],
    ['载重(磅)', '否', '选填，必须是大于0的数字', '45000, 44000'],
    ['容量(立方英尺)', '否', '选填，必须是大于0的数字', '3800, 2700'],
    ['状态', '否', '选填，只能是：available（可用）、in_use（使用中）、maintenance（维护中）、retired（已退役）', 'available'],
    ['备注', '否', '选填，任意文本', 'Regular maintenance, DOT compliant'],
  ]

  instructions.forEach((row, index) => {
    const excelRow = instructionSheet.getRow(index + 2)
    row.forEach((value, colIndex) => {
      excelRow.getCell(colIndex + 1).value = value
    })
  })

  // 导入须知
  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = '货柜批量导入须知'
  noteSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }
  
  const notes = [
    '',
    '1. 必填字段（红色表头）：货柜代码、货柜类型',
    '2. 货柜代码必须唯一，不能与系统中已有的货柜代码重复',
    '3. 状态只能是：available, in_use, maintenance, retired',
    '4. 导入采用"全部成功或全部失败"模式',
    '5. 选填字段默认隐藏，点击Excel中列标题左侧的"+"号可以展开',
    '6. 强烈建议使用"选择性粘贴→值"来粘贴数据',
    '   Windows: Ctrl+Alt+V，然后选择"值"',
    '   或右键 → 选择性粘贴 → 值',
    '7. 第2行为示例数据，可以参考后删除或覆盖',
    '8. 已预填200行标准格式',
  ]

  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })

  return workbook
}

export async function downloadTrailerExcelFile(workbook: ExcelJS.Workbook, filename: string = '货柜导入模板.xlsx') {
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
