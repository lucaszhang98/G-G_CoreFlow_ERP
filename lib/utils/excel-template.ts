/**
 * Excel 模板生成工具（使用ExcelJS支持数据验证和下拉框）
 */

import ExcelJS from 'exceljs'

/**
 * 生成订单导入Excel模板（带数据验证、下拉框、200行预填充）
 */
export async function generateOrderImportTemplate(
  templateData?: { 
    customers?: { code: string; name: string }[]
    locations?: { location_code: string; name: string }[]
  }
) {
  const customers = templateData?.customers || []
  const locations = templateData?.locations || []
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'G&G CoreFlow ERP'
  workbook.created = new Date()

  // ===== Sheet 1: 订单导入模板 =====
  const templateSheet = workbook.addWorksheet('订单导入模板', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] // 冻结前3行（包含提示）
  })

  // 定义列（Order必填 -> Order选填 -> Detail必填 -> Detail选填）
  const columns = [
    // === Order必填字段 ===
    { key: 'order_number', header: '订单号', width: 15, required: true },
    { key: 'customer_code', header: '客户代码', width: 12, required: true },
    { key: 'order_date', header: '订单日期', width: 12, required: true },
    { key: 'operation_mode', header: '操作方式', width: 10, required: true },
    { key: 'delivery_location', header: '目的地', width: 12, required: true },
    { key: 'container_type', header: '货柜类型', width: 10, required: true },
    { key: 'eta', header: 'ETA', width: 12, required: true },
    { key: 'mbl', header: 'MBL', width: 15, required: true },
    { key: 'do_issued', header: 'DO', width: 8, required: true },
    // === Order选填字段（隐藏） ===
    { key: 'user', header: '负责人', width: 10, required: false, hidden: true },
    { key: 'status', header: '状态', width: 10, required: false, hidden: true },
    { key: 'total_amount', header: '订单金额', width: 10, required: false, hidden: true },
    { key: 'discount_amount', header: '折扣金额', width: 10, required: false, hidden: true },
    { key: 'tax_amount', header: '税费', width: 10, required: false, hidden: true },
    { key: 'final_amount', header: '最终金额', width: 10, required: false, hidden: true },
    { key: 'lfd', header: 'LFD', width: 12, required: false, hidden: true },
    { key: 'pickup_date', header: '提柜日期', width: 12, required: false, hidden: true },
    { key: 'ready_date', header: '就绪日期', width: 12, required: false, hidden: true },
    { key: 'return_deadline', header: '归还截止日期', width: 12, required: false, hidden: true },
    { key: 'notes', header: '备注', width: 20, required: false, hidden: true },
    // === Detail必填字段 ===
    { key: 'detail_location', header: '送仓地点', width: 12, required: true },
    { key: 'detail_type', header: '性质', width: 10, required: true },
    { key: 'quantity', header: '数量', width: 8, required: true },
    { key: 'volume', header: '体积', width: 10, required: true },
    // === Detail选填字段（隐藏） ===
    { key: 'fba', header: 'FBA', width: 15, required: false, hidden: true },
    { key: 'po', header: 'PO', width: 15, required: false, hidden: true },
    { key: 'detail_notes', header: '明细备注', width: 20, required: false, hidden: true },
    { key: 'window_period', header: '窗口期', width: 12, required: false, hidden: true },
  ]

  // 第1行：表头
  templateSheet.columns = columns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width,
    hidden: col.hidden || false,
    outlineLevel: col.hidden ? 1 : 0 // 分组用于折叠
  }))

  // 设置表头样式（第1行）
  const headerRow = templateSheet.getRow(1)
  headerRow.height = 20
  headerRow.font = { bold: true, size: 11 }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1)
    if (col.required) {
      // 必填字段：红色粗体
      cell.font = { bold: true, size: 11, color: { argb: 'FFFF0000' } }
    } else {
      // 选填字段：黑色粗体
      cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } }
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' } // 浅灰背景
    }
  })

  // ===== 数据验证和下拉框 =====
  
  // 准备下拉选项
  const customerCodes = customers.map(c => c.code).filter(c => c).sort()
  const locationCodes = locations.map(l => l.location_code).filter(l => l).sort()
  
  const dropdownOptions = {
    operation_mode: ['拆柜', '直送'],
    container_type: ['40DH', '45DH', '40RH', '45RH', '20GP', '其他'],
    do_issued: ['是', '否'],
    status: ['待处理', '已确认', '已发货', '已送达', '已取消', '已归档'],
    detail_type: ['AMZ', '扣货', '已放行', '私仓', '转仓']
  }

  // ===== 预填充200行数据（从第2行到第201行） =====
  const ROW_COUNT = 200
  
  for (let rowNum = 2; rowNum <= ROW_COUNT + 1; rowNum++) {
    const row = templateSheet.getRow(rowNum)
    
    // 设置行高
    row.height = 18
    
    // 为每个单元格设置样式和验证
    columns.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      const columnLetter = String.fromCharCode(65 + colIndex) // A, B, C...
      
      // 基础样式
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
      }
      
      // 设置日期单元格的格式为 yyyy-mm-dd
      if (['order_date', 'eta', 'lfd', 'pickup_date', 'ready_date', 'return_deadline'].includes(col.key)) {
        cell.numFmt = 'yyyy-mm-dd' // 自定义日期格式
      }
      
      // 根据字段类型设置数据验证
      switch (col.key) {
        // 客户代码下拉（引用参考表）
        case 'customer_code':
          if (customerCodes.length > 0) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: false,
              formulae: [`客户代码参考!$A$2:$A$${customerCodes.length + 1}`], // 参考表的行号不变
              showErrorMessage: true,
              errorTitle: '无效的客户代码',
              error: '请从下拉列表中选择有效的客户代码'
            }
          }
          break
        
        // 目的地和送仓地点下拉（引用参考表）
        case 'delivery_location':
        case 'detail_location':
          if (locationCodes.length > 0) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: col.key === 'delivery_location' ? false : false,
              formulae: [`位置代码参考!$A$2:$A$${locationCodes.length + 1}`], // 参考表的行号不变
              showErrorMessage: true,
              errorTitle: '无效的位置代码',
              error: '请从下拉列表中选择有效的位置代码'
            }
          }
          break
        
        // 固定选项下拉框
        case 'operation_mode':
        case 'container_type':
        case 'do_issued':
        case 'status':
        case 'detail_type':
          cell.dataValidation = {
            type: 'list',
            allowBlank: !col.required,
            formulae: [`"${dropdownOptions[col.key as keyof typeof dropdownOptions].join(',')}"`],
            showErrorMessage: true,
            errorTitle: '无效选项',
            error: `请从下拉列表中选择：${dropdownOptions[col.key as keyof typeof dropdownOptions].join('、')}`
          }
          break
        
        // 日期字段（已在上面统一设置了 numFmt，这里只设置验证）
        case 'order_date':
        case 'eta':
        case 'lfd':
        case 'pickup_date':
        case 'ready_date':
        case 'return_deadline':
          cell.dataValidation = {
            type: 'date',
            operator: 'greaterThan',
            formulae: [new Date('2020-01-01')],
            allowBlank: !col.required,
            showErrorMessage: true,
            errorTitle: '无效的日期',
            error: '请输入正确的日期或使用日期选择器'
          }
          break
        
        // 数字字段（金额）
        case 'total_amount':
        case 'discount_amount':
        case 'tax_amount':
        case 'final_amount':
          cell.numFmt = '#,##0.00'
          cell.dataValidation = {
            type: 'decimal',
            operator: 'greaterThanOrEqual',
            formulae: [0],
            allowBlank: true,
            showErrorMessage: true,
            errorTitle: '无效的金额',
            error: '请输入非负数字'
          }
          break
        
        // 数量（正整数）
        case 'quantity':
          cell.dataValidation = {
            type: 'whole',
            operator: 'greaterThan',
            formulae: [0],
            allowBlank: false,
            showErrorMessage: true,
            errorTitle: '无效的数量',
            error: '请输入大于0的整数'
          }
          break
        
        // 体积（正数）
        case 'volume':
          cell.dataValidation = {
            type: 'decimal',
            operator: 'greaterThan',
            formulae: [0],
            allowBlank: false,
            showErrorMessage: true,
            errorTitle: '无效的体积',
            error: '请输入大于0的数字'
          }
          break
      }
    })
  }
  
  // 添加示例数据到第2行
  const exampleRow = templateSheet.getRow(2)
  exampleRow.getCell(1).value = 'ABCD1234567' // 订单号
  exampleRow.getCell(2).value = customerCodes[0] || 'HYD' // 客户代码
  exampleRow.getCell(3).value = new Date('2024-12-15') // 订单日期
  exampleRow.getCell(4).value = '拆柜' // 操作方式
  exampleRow.getCell(5).value = locationCodes[0] || 'LAX001' // 目的地
  exampleRow.getCell(6).value = '40DH' // 货柜类型
  exampleRow.getCell(7).value = new Date('2024-12-20') // ETA
  exampleRow.getCell(8).value = 'MBL123456' // MBL
  exampleRow.getCell(9).value = '是' // DO
  exampleRow.getCell(10).value = '' // 负责人
  exampleRow.getCell(11).value = '待处理' // 状态
  exampleRow.getCell(12).value = 0 // 订单金额
  exampleRow.getCell(13).value = 0 // 折扣金额
  exampleRow.getCell(14).value = 0 // 税费
  exampleRow.getCell(15).value = 0 // 最终金额
  exampleRow.getCell(16).value = new Date('2024-12-25') // LFD
  exampleRow.getCell(17).value = '' // 提柜日期
  exampleRow.getCell(18).value = '' // 就绪日期
  exampleRow.getCell(19).value = '' // 归还截止日期
  exampleRow.getCell(20).value = '测试订单' // 备注
  exampleRow.getCell(21).value = locationCodes[1] || locationCodes[0] || 'LAX002' // 送仓地点
  exampleRow.getCell(22).value = 'AMZ' // 性质
  exampleRow.getCell(23).value = 100 // 数量
  exampleRow.getCell(24).value = 50.5 // 体积
  exampleRow.getCell(25).value = 'FBA123' // FBA
  exampleRow.getCell(26).value = 'PO123456' // PO
  exampleRow.getCell(27).value = '测试明细' // 明细备注
  exampleRow.getCell(28).value = '2024-12-20至2024-12-25' // 窗口期

  // ===== Sheet 2: 字段说明 =====
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', key: 'field', width: 20 },
    { header: '必填', key: 'required', width: 8 },
    { header: '格式/选项', key: 'format', width: 35 },
    { header: '说明', key: 'description', width: 50 },
  ]

  const instructions = [
    ['=== Order必填字段 ===', '', '', ''],
    ['订单号', '是', '4位大写字母+7位数字', '如：ABCD1234567（必须唯一，不可重复）'],
    ['客户代码', '是', '下拉选择', '从下拉列表选择客户代码'],
    ['订单日期', '是', '日期格式（非文本）', '使用Excel日期格式，不要用文本。详见"重要说明"第2条'],
    ['操作方式', '是', '下拉：拆柜/直送', '从下拉列表选择'],
    ['目的地', '是', '下拉选择', '从下拉列表选择位置代码'],
    ['货柜类型', '是', '下拉：40DH/45DH/40RH/45RH/20GP/其他', '从下拉列表选择'],
    ['ETA', '是', '日期格式（非文本）', '预计到港日期，使用Excel日期格式'],
    ['MBL', '是', '文本（最长100字符）', '主提单号'],
    ['DO', '是', '下拉：是/否', 'DO是否已签发'],
    ['', '', '', ''],
    ['=== Order选填字段（默认隐藏）===', '', '', ''],
    ['负责人', '否', '文本', '用户姓名，可留空'],
    ['状态', '否', '下拉选择', '默认为"待处理"'],
    ['订单金额', '否', '数字', '非负数，默认为0'],
    ['折扣金额', '否', '数字', '非负数，默认为0'],
    ['税费', '否', '数字', '非负数，默认为0'],
    ['最终金额', '否', '数字', '非负数，默认为0'],
    ['LFD', '否', '日期格式', 'Last Free Day，使用Excel日期格式'],
    ['提柜日期', '否', '日期格式', '可留空，如填写需使用日期格式'],
    ['就绪日期', '否', '日期格式', '可留空，如填写需使用日期格式'],
    ['归还截止日期', '否', '日期格式', '可留空，如填写需使用日期格式'],
    ['备注', '否', '文本', '订单备注'],
    ['', '', '', ''],
    ['=== Detail必填字段 ===', '', '', ''],
    ['送仓地点', '是', '下拉选择', '从下拉列表选择位置代码'],
    ['性质', '是', '下拉：AMZ/扣货/已放行/私仓/转仓', '从下拉列表选择'],
    ['数量', '是', '正整数', '必须大于0'],
    ['体积', '是', '正数', '必须大于0，可以是小数'],
    ['', '', '', ''],
    ['=== Detail选填字段（默认隐藏）===', '', '', ''],
    ['FBA', '否', '文本', '可留空'],
    ['PO', '否', '文本（最长1000字符）', '采购订单号'],
    ['明细备注', '否', '文本', '订单明细备注'],
    ['窗口期', '否', '文本（最长100字符）', '送仓窗口期，可留空'],
    ['', '', '', ''],
    ['重要说明', '', '', ''],
    ['1. 下拉框', '', '', '所有带下拉的字段点击即可看到选项，防止数据错误'],
    ['2. 粘贴数据的正确方法（重要）', '', '', '从其他地方复制数据时，请使用"选择性粘贴"'],
    ['  - 推荐方法', '', '', '复制数据→右键目标单元格→选择性粘贴→值（V）→确定'],
    ['  - 快捷键', '', '', 'Ctrl+Alt+V → V → Enter（Windows）或 Cmd+Ctrl+V → V → Enter（Mac）'],
    ['  - 为什么要这样', '', '', '只粘贴值可以保留模板的格式设置（日期、下拉框等）'],
    ['  - 如果直接粘贴', '', '', '可能会覆盖模板格式，导致日期变成文本、下拉框失效'],
    ['3. 日期字段', '', '', '日期单元格已预设为yyyy-mm-dd格式'],
    ['  - 使用选择性粘贴', '', '', '粘贴日期数据时使用"选择性粘贴→值"，会自动应用yyyy-mm-dd格式'],
    ['  - 日期选择器', '', '', '点击日期单元格，会自动弹出日历选择器'],
    ['  - 手动输入', '', '', '直接输入2025-12-11格式，或2025/12/11会自动转换'],
    ['4. 表头颜色', '', '', '红色表头=必填字段，黑色表头=选填字段'],
    ['5. 隐藏列', '', '', 'Excel左上角点击"1"=折叠选填列，点击"2"=展开全部列'],
    ['6. 预填充行', '', '', '已预设200行标准格式，可直接填写。超出200行可复制粘贴'],
    ['7. 订单号唯一性', '', '', '订单号必须唯一，重复导入会报错（防止误操作）'],
    ['8. 一对多关系', '', '', '同一订单号可以有多行，每行代表一个送仓明细'],
    ['9. 订单字段一致性', '', '', '同一订单的多行中，订单字段必须一致'],
    ['10. 事务处理', '', '', '导入失败会全部回滚，确保数据一致性'],
  ]

  instructions.forEach((row) => {
    instructionSheet.addRow(row)
  })

  // 设置说明表样式
  instructionSheet.getRow(1).font = { bold: true }
  instructionSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  instructionSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // ===== Sheet 3: 客户代码参考 =====
  const customerSheet = workbook.addWorksheet('客户代码参考')
  customerSheet.columns = [
    { header: '客户代码', key: 'code', width: 15 },
    { header: '客户名称', key: 'name', width: 30 }
  ]
  
  customers.forEach(customer => {
    customerSheet.addRow({
      code: customer.code,
      name: customer.name
    })
  })
  
  customerSheet.getRow(1).font = { bold: true }
  customerSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  }
  customerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // ===== Sheet 4: 位置代码参考 =====
  const locationSheet = workbook.addWorksheet('位置代码参考')
  locationSheet.columns = [
    { header: '位置代码', key: 'code', width: 15 },
    { header: '位置名称', key: 'name', width: 30 }
  ]
  
  locations.forEach(location => {
    locationSheet.addRow({
      code: location.location_code,
      name: location.name
    })
  })
  
  locationSheet.getRow(1).font = { bold: true }
  locationSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  }
  locationSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  return workbook
}

/**
 * 下载Excel文件（ExcelJS版本）
 */
export async function downloadExcelFile(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
  
  // 创建下载链接
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
