/**
 * 位置导入Excel模板生成
 */

import ExcelJS from 'exceljs'

export async function generateLocationImportTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  
  const dataSheet = workbook.addWorksheet('位置数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  })

  const columns = [
    // 必填字段
    { key: 'location_code', header: '位置代码', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'name', header: '位置名称', width: 20, required: true, hidden: false, outlineLevel: 0 },
    { key: 'location_type', header: '位置类型', width: 15, required: true, hidden: false, outlineLevel: 0 },
    
    // 选填字段（默认隐藏，可通过点击"+"展开）
    { key: 'address_line1', header: '地址行1', width: 30, required: false, hidden: true, outlineLevel: 1 },
    { key: 'address_line2', header: '地址行2', width: 30, required: false, hidden: true, outlineLevel: 1 },
    { key: 'city', header: '城市', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'state', header: '州/省', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'postal_code', header: '邮政编码', width: 12, required: false, hidden: true, outlineLevel: 1 },
    { key: 'country', header: '国家', width: 12, required: false, hidden: true, outlineLevel: 1 },
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
    // 位置类型：下拉列表（只有3种）
    dataSheet.getCell(`C${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"port,amazon,warehouse"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      errorStyle: 'error',
      error: '请从下拉列表中选择位置类型：port（码头/查验站）、amazon（亚马逊）、warehouse（仓库）'
    }
  }

  // 示例数据 - 使用美国加州示例
  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'LA-WH-01'
  exampleRow.getCell(2).value = 'Los Angeles Main Warehouse'
  exampleRow.getCell(3).value = 'warehouse'
  exampleRow.getCell(4).value = '5678 Industry Way'
  exampleRow.getCell(5).value = 'Building A'
  exampleRow.getCell(6).value = 'Carson'
  exampleRow.getCell(7).value = 'CA'
  exampleRow.getCell(8).value = '90745'
  exampleRow.getCell(9).value = 'USA'
  exampleRow.getCell(10).value = '24/7 operation, forklift access'

  // 字段说明
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 15 },
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
    ['位置代码', '是', '必填，最多50个字符，建议使用易识别的代码', 'LA-WH-01, SCK8, ONT2'],
    ['位置名称', '是', '必填，最多200个字符', 'Los Angeles Main Warehouse'],
    ['位置类型', '是', '必填，只能是：port（码头/查验站）、amazon（亚马逊）、warehouse（仓库）', 'warehouse, port, amazon'],
    ['地址行1', '否', '选填，最多200个字符', '5678 Industry Way'],
    ['地址行2', '否', '选填，最多200个字符', 'Building A'],
    ['城市', '否', '选填，最多100个字符', 'Carson, Long Beach, Ontario'],
    ['州/省', '否', '选填，最多100个字符', 'CA or California'],
    ['邮政编码', '否', '选填，最多20个字符', '90745, 90802, 91761'],
    ['国家', '否', '选填，最多100个字符', 'USA'],
    ['备注', '否', '选填，任意文本', '24/7 operation, forklift access'],
  ]

  instructions.forEach((row, index) => {
    const excelRow = instructionSheet.getRow(index + 2)
    row.forEach((value, colIndex) => {
      excelRow.getCell(colIndex + 1).value = value
    })
  })

  // 导入须知
  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = '位置批量导入须知'
  noteSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }
  
  const notes = [
    '',
    '1. 必填字段（红色表头）：位置代码、位置名称、位置类型',
    '2. 位置代码必须唯一，不能与系统中已有的位置代码重复',
    '3. 位置类型只能是：port（码头/查验站）、amazon（亚马逊）、warehouse（仓库）',
    '4. 导入采用"全部成功或全部失败"模式',
    '5. 选填字段默认隐藏，点击Excel中列标题左侧的"1"或"2"可以展开/收起',
    '6. 强烈建议使用"选择性粘贴→值"来粘贴数据',
    '   Windows: Ctrl+Alt+V，然后选择"值"',
    '   或右键 → 选择性粘贴 → 值',
    '7. 第2行为示例数据，可以参考后删除或覆盖',
    '8. 已预填200行标准格式',
    '',
    '位置类型说明：',
    '- port: 码头/查验站',
    '- amazon: 亚马逊仓库',
    '- warehouse: 普通仓库',
  ]

  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })

  return workbook
}

export async function downloadLocationExcelFile(workbook: ExcelJS.Workbook, filename: string = '位置导入模板.xlsx') {
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
