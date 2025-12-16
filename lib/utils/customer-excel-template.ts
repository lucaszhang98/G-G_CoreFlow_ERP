/**
 * 客户导入Excel模板生成
 */

import ExcelJS from 'exceljs'

export async function generateCustomerImportTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  
  // 主数据工作表
  const dataSheet = workbook.addWorksheet('客户数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  })

  // 定义列（按照：客户必填 -> 客户选填 -> 联系人选填 的顺序）
  const columns = [
    // 客户必填字段（红色）
    { key: 'code', header: '客户代码', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'name', header: '客户名称', width: 20, required: true, hidden: false, outlineLevel: 0 },
    
    // 客户选填字段（黑色，默认隐藏）
    { key: 'company_name', header: '公司名称', width: 25, required: false, hidden: true, outlineLevel: 1 },
    { key: 'status', header: '状态', width: 12, required: false, hidden: true, outlineLevel: 1 },
    { key: 'credit_limit', header: '信用额度', width: 15, required: false, hidden: true, outlineLevel: 1 },
    
    // 联系人选填字段（黑色，默认隐藏）
    { key: 'contact_name', header: '联系人姓名', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_phone', header: '联系人电话', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_email', header: '联系人邮箱', width: 25, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_address_line1', header: '联系人地址行1', width: 30, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_address_line2', header: '联系人地址行2', width: 30, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_city', header: '联系人城市', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_state', header: '联系人州/省', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_postal_code', header: '联系人邮政编码', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'contact_country', header: '联系人国家', width: 15, required: false, hidden: true, outlineLevel: 1 },
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
      color: { argb: col.required ? 'FFFF0000' : 'FF000000' }, // 必填红色，选填黑色
      size: 11
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // 预填200行，设置数据验证和格式
  for (let rowNum = 2; rowNum <= 201; rowNum++) {
    const row = dataSheet.getRow(rowNum)
    
    // 状态：下拉列表
    dataSheet.getCell(`D${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"active,inactive"'],
      showErrorMessage: true,
      errorTitle: '无效输入',
      errorStyle: 'error',
      error: '请从下拉列表中选择：active 或 inactive'
    }
    
    // 信用额度：数字格式
    dataSheet.getCell(`E${rowNum}`).numFmt = '#,##0.00'
    dataSheet.getCell(`E${rowNum}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formulae: [0],
      showErrorMessage: true,
      errorTitle: '无效输入',
      errorStyle: 'warning',
      error: '信用额度必须是大于等于0的数字'
    }
  }

  // 示例数据（第2行，包含联系人信息）- 使用美国加州示例
  const exampleRow = dataSheet.getRow(2)
  exampleRow.getCell(1).value = 'ACME001'
  exampleRow.getCell(2).value = 'Acme Logistics Inc'
  exampleRow.getCell(3).value = 'Acme Corporation'
  exampleRow.getCell(4).value = 'active'
  exampleRow.getCell(5).value = 50000
  exampleRow.getCell(6).value = 'John Smith'
  exampleRow.getCell(7).value = '+1-310-555-0123'
  exampleRow.getCell(8).value = 'john.smith@acmelogistics.com'
  exampleRow.getCell(9).value = '1234 Harbor Blvd'
  exampleRow.getCell(10).value = 'Suite 200'
  exampleRow.getCell(11).value = 'Los Angeles'
  exampleRow.getCell(12).value = 'CA'
  exampleRow.getCell(13).value = '90001'
  exampleRow.getCell(14).value = 'USA'

  // 字段说明工作表
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 15 },
    { header: '是否必填', width: 12 },
    { header: '格式要求', width: 50 },
    { header: '示例', width: 20 }
  ]

  // 设置说明表头样式
  const instrHeaderRow = instructionSheet.getRow(1)
  instrHeaderRow.font = { bold: true }
  instrHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // 添加字段说明（包含联系人字段）- 使用美国加州示例
  const instructions = [
    ['客户代码', '是', '必填，最多50个字符，只能包含大写字母、数字、下划线和连字符。例如：ACME001、CLIENT_A、VENDOR-123', 'ACME001'],
    ['客户名称', '是', '必填，最多200个字符', 'Acme Logistics Inc'],
    ['公司名称', '否', '选填，最多200个字符', 'Acme Corporation'],
    ['状态', '否', '选填，只能是 active（活跃）或 inactive（停用），默认为 active', 'active'],
    ['信用额度', '否', '选填，必须是大于等于0的数字，默认为0', '50000.00'],
    ['联系人姓名', '否', '选填，最多100个字符', 'John Smith'],
    ['联系人电话', '否', '选填，最多50个字符', '+1-310-555-0123'],
    ['联系人邮箱', '否', '选填，必须是有效的邮箱格式', 'john.smith@acmelogistics.com'],
    ['联系人地址行1', '否', '选填，最多200个字符', '1234 Harbor Blvd'],
    ['联系人地址行2', '否', '选填，最多200个字符', 'Suite 200'],
    ['联系人城市', '否', '选填，最多100个字符', 'Los Angeles'],
    ['联系人州/省', '否', '选填，最多100个字符', 'CA or California'],
    ['联系人邮政编码', '否', '选填，最多20个字符', '90001'],
    ['联系人国家', '否', '选填，最多100个字符', 'USA'],
  ]

  instructions.forEach((row, index) => {
    const excelRow = instructionSheet.getRow(index + 2)
    row.forEach((value, colIndex) => {
      excelRow.getCell(colIndex + 1).value = value
    })
  })

  // 重要提示
  const noteSheet = workbook.addWorksheet('导入须知')
  noteSheet.getCell('A1').value = '客户批量导入须知'
  noteSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }
  
  const notes = [
    '',
    '1. 必填字段（红色表头）必须填写，否则会导入失败',
    '2. 客户代码必须唯一，不能与系统中已有的客户代码重复',
    '3. 客户代码只能包含大写字母、数字、下划线和连字符',
    '4. 状态字段只能填写 active 或 inactive',
    '5. 信用额度必须是大于等于0的数字',
    '6. 联系人邮箱必须是有效的邮箱格式',
    '7. 导入采用"全部成功或全部失败"模式，如果有任何一行数据错误，整个导入都会失败',
    '8. 选填字段（黑色表头）默认隐藏，点击列标题左侧的"+"号可以展开显示',
    '9. 强烈建议使用"选择性粘贴→值"来粘贴数据，避免破坏预设的格式和下拉列表',
    '   Windows: Ctrl+Alt+V 然后选择"值"',
    '   或者右键→选择性粘贴→值',
    '10. 第2行为示例数据，可以参考格式后删除或覆盖',
    '11. 已预填200行标准格式，如需更多行，可复制粘贴',
    '',
    '常见问题：',
    'Q: 如何显示隐藏的选填字段？',
    'A: 点击列标题左侧的"+"号（第2列和第5列之间）可以展开所有选填字段',
    '',
    'Q: 如何使用下拉列表？',
    'A: 点击单元格右侧的下拉箭头，从列表中选择',
    '',
    'Q: 粘贴数据后下拉列表消失了怎么办？',
    'A: 请使用"选择性粘贴→值"（Windows: Ctrl+Alt+V，然后选择"值"）',
    '',
    'Q: 导入失败了怎么办？',
    'A: 查看错误提示，修正对应行的数据后重新导入',
  ]

  notes.forEach((note, index) => {
    noteSheet.getCell(`A${index + 1}`).value = note
  })

  return workbook
}

export async function downloadCustomerExcelFile(workbook: ExcelJS.Workbook, filename: string = '客户导入模板.xlsx') {
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
