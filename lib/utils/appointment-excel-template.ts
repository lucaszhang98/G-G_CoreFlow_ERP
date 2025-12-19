/**
 * 预约批量导入Excel模板生成器
 */

import * as ExcelJS from 'exceljs'

/**
 * 生成预约批量导入模板
 */
export async function generateAppointmentImportTemplate(
  templateData?: { 
    locations?: { location_code: string; name: string }[]
  }
): Promise<ExcelJS.Workbook> {
  const locations = templateData?.locations || []
  console.log('[预约模板生成] 接收到的位置数据:', locations.length, '个位置')
  
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'G&G CoreFlow ERP'
  workbook.created = new Date()
  
  // 主数据工作表
  const dataSheet = workbook.addWorksheet('预约数据', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  })

  // ===== 1. 定义列（分组：主表必填 -> 主表选填 -> 明细必填 -> 明细选填） =====
  const columns = [
    // 预约主表必填字段（红色）
    { key: 'reference_number', header: '预约号码', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'delivery_method', header: '派送方式', width: 12, required: true, hidden: false, outlineLevel: 0 },
    { key: 'appointment_account', header: '预约账号', width: 12, required: true, hidden: false, outlineLevel: 0 },
    { key: 'appointment_type', header: '预约类型', width: 12, required: true, hidden: false, outlineLevel: 0 },
    { key: 'origin_location', header: '起始地', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'destination_location', header: '目的地', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'confirmed_start', header: '送货时间', width: 18, required: true, hidden: false, outlineLevel: 0 },
    
    // 预约主表选填字段（黑色，默认隐藏）
    { key: 'rejected', header: '拒收', width: 10, required: false, hidden: true, outlineLevel: 1 },
    { key: 'po', header: 'PO', width: 15, required: false, hidden: true, outlineLevel: 1 },
    { key: 'notes', header: '备注', width: 20, required: false, hidden: true, outlineLevel: 1 },
    
    // 预约明细必填字段（红色）
    { key: 'order_number', header: '订单号', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'detail_location', header: '仓点', width: 15, required: true, hidden: false, outlineLevel: 0 },
    { key: 'delivery_nature', header: '性质', width: 12, required: true, hidden: false, outlineLevel: 0 },
    { key: 'estimated_pallets', header: '预计板数', width: 12, required: true, hidden: false, outlineLevel: 0 },
  ]

  // 设置列属性，包括折叠功能
  dataSheet.columns = columns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width,
    hidden: col.hidden || false,
    outlineLevel: col.outlineLevel || 0
  }))

  // ===== 2. 设置表头样式 =====
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

  // ===== 3. 预填200行，设置数据验证和格式 =====
  const locationCodes = locations.map(l => l.location_code).filter(l => l).sort()
  const ROW_COUNT = 200
  
  for (let rowNum = 2; rowNum <= ROW_COUNT + 1; rowNum++) {
    const row = dataSheet.getRow(rowNum)
    row.height = 18
    
    // A列：预约号码 - 设置为文本格式（防止被当作数字）
    dataSheet.getCell(`A${rowNum}`).numFmt = '@'  // @ 表示文本格式
    
    // B列：派送方式 - 下拉列表
    dataSheet.getCell(`B${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"私仓,自提,直送,卡派"'],
      showErrorMessage: true,
      errorTitle: '输入错误',
      errorStyle: 'error',
      error: '请从下拉列表中选择：私仓、自提、直送、卡派'
    }
    
    // C列：预约账号 - 下拉列表
    dataSheet.getCell(`C${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"AA,YTAQ,AYIE,KP,OLPN,DATONG,GG,other"'],
      showErrorMessage: true,
      errorTitle: '输入错误',
      errorStyle: 'error',
      error: '请从下拉列表中选择'
    }
    
    // D列：预约类型 - 下拉列表
    dataSheet.getCell(`D${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"卡板,地板"'],
      showErrorMessage: true,
      errorTitle: '输入错误',
      errorStyle: 'error',
      error: '请从下拉列表中选择：卡板、地板'
    }
    
    // E列：起始地 - 下拉列表（引用位置代码参考表）
    if (locationCodes.length > 0) {
      dataSheet.getCell(`E${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`位置代码参考!$A$2:$A$${locationCodes.length + 1}`],
        showErrorMessage: true,
        errorTitle: '无效的位置代码',
        error: '请从下拉列表中选择有效的位置代码'
      }
    }
    
    // F列：目的地 - 下拉列表（引用位置代码参考表）
    if (locationCodes.length > 0) {
      dataSheet.getCell(`F${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`位置代码参考!$A$2:$A$${locationCodes.length + 1}`],
        showErrorMessage: true,
        errorTitle: '无效的位置代码',
        error: '请从下拉列表中选择有效的位置代码'
      }
    }
    
    // G列：送货时间 - 日期时间格式（yyyy-mm-dd hh:mm）
    const timeCell = dataSheet.getCell(`G${rowNum}`)
    timeCell.numFmt = 'yyyy-mm-dd hh:mm'  // 设置日期时间格式
    timeCell.dataValidation = {
      type: 'date',
      operator: 'greaterThan',
      formulae: [new Date('2020-01-01')],
      allowBlank: false,
      showErrorMessage: true,
      errorTitle: '无效的日期',
      error: '请输入正确的日期时间格式'
    }
    
    // H列：拒收 - 下拉列表
    dataSheet.getCell(`H${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"是,否"']
    }
    
    // I列：PO - 文本格式
    dataSheet.getCell(`I${rowNum}`).numFmt = '@'
    
    // J列：备注 - 文本格式
    dataSheet.getCell(`J${rowNum}`).numFmt = '@'
    
    // K列：订单号 - 文本格式（防止被当作数字）
    dataSheet.getCell(`K${rowNum}`).numFmt = '@'
    
    // L列：仓点 - 下拉列表（引用位置代码参考表）
    if (locationCodes.length > 0) {
      dataSheet.getCell(`L${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`位置代码参考!$A$2:$A$${locationCodes.length + 1}`],
        showErrorMessage: true,
        errorTitle: '无效的位置代码',
        error: '请从下拉列表中选择有效的位置代码'
      }
    }
    
    // M列：性质 - 下拉列表
    dataSheet.getCell(`M${rowNum}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"AMZ,扣货,已放行,私仓"'],
      showErrorMessage: true,
      errorTitle: '输入错误',
      errorStyle: 'error',
      error: '请从下拉列表中选择：AMZ、扣货、已放行、私仓'
    }
    
    // N列：预计板数 - 正整数（保持数字格式）
    dataSheet.getCell(`N${rowNum}`).numFmt = '0'  // 整数格式
    dataSheet.getCell(`N${rowNum}`).dataValidation = {
      type: 'whole',
      operator: 'greaterThan',
      formulae: [0],
      showErrorMessage: true,
      errorTitle: '输入错误',
      errorStyle: 'error',
      error: '预计板数必须是正整数'
    }
  }

  // ===== 4. 示例数据（3行，主表数据每行都填写） =====
  // 使用真实的位置代码或示例代码
  const exampleLocation1 = locationCodes[0] || 'LAX01'
  const exampleLocation2 = locationCodes[1] || 'ONT01'
  const exampleLocation3 = locationCodes[2] || 'DEN01'
  
  // 示例1：单个预约，单个明细
  const example1 = dataSheet.getRow(2)
  example1.getCell(1).value = 'AP-2025001'         // A: 预约号码
  example1.getCell(2).value = '直送'                // B: 派送方式
  example1.getCell(3).value = 'AA'                  // C: 预约账号
  example1.getCell(4).value = '卡板'                // D: 预约类型
  example1.getCell(5).value = exampleLocation1      // E: 起始地
  example1.getCell(6).value = exampleLocation2      // F: 目的地
  example1.getCell(7).value = '2025-12-20 14:30'   // G: 送货时间
  example1.getCell(8).value = '否'                  // H: 拒收
  example1.getCell(9).value = 'PO12345'            // I: PO
  example1.getCell(10).value = '优先配送'           // J: 备注
  example1.getCell(11).value = 'ABCD1234567'       // K: 订单号
  example1.getCell(12).value = exampleLocation2     // L: 仓点
  example1.getCell(13).value = 'AMZ'               // M: 性质
  example1.getCell(14).value = 50                  // N: 预计板数

  // 示例2：同一预约，第2个明细（主表数据重复填写）
  const example2 = dataSheet.getRow(3)
  example2.getCell(1).value = 'AP-2025001'         // A: 预约号码（相同）
  example2.getCell(2).value = '直送'                // B: 派送方式（相同）
  example2.getCell(3).value = 'AA'                  // C: 预约账号（相同）
  example2.getCell(4).value = '卡板'                // D: 预约类型（相同）
  example2.getCell(5).value = exampleLocation1      // E: 起始地（相同）
  example2.getCell(6).value = exampleLocation2      // F: 目的地（相同）
  example2.getCell(7).value = '2025-12-20 14:30'   // G: 送货时间（相同）
  example2.getCell(8).value = '否'                  // H: 拒收（相同）
  example2.getCell(9).value = 'PO12345'            // I: PO（相同）
  example2.getCell(10).value = '优先配送'           // J: 备注（相同）
  example2.getCell(11).value = 'ABCD1234567'       // K: 订单号（相同）
  example2.getCell(12).value = exampleLocation3     // L: 仓点（不同）
  example2.getCell(13).value = '扣货'               // M: 性质（不同）
  example2.getCell(14).value = 30                  // N: 预计板数（不同）

  // 示例3：新的预约
  const example3 = dataSheet.getRow(4)
  example3.getCell(1).value = 'AP-2025002'         // A: 预约号码
  example3.getCell(2).value = '自提'                // B: 派送方式
  example3.getCell(3).value = 'YTAQ'               // C: 预约账号
  example3.getCell(4).value = '地板'                // D: 预约类型
  example3.getCell(5).value = exampleLocation1      // E: 起始地
  example3.getCell(6).value = exampleLocation3      // F: 目的地
  example3.getCell(7).value = '2025-12-21 10:00'   // G: 送货时间
  example3.getCell(8).value = '否'                  // H: 拒收
  example3.getCell(9).value = ''                   // I: PO
  example3.getCell(10).value = ''                  // J: 备注
  example3.getCell(11).value = 'EFGH7890123'       // K: 订单号
  example3.getCell(12).value = exampleLocation3     // L: 仓点
  example3.getCell(13).value = '私仓'               // M: 性质
  example3.getCell(14).value = 80                  // N: 预计板数

  // ===== 5. 字段说明工作表 =====
  const instructionSheet = workbook.addWorksheet('字段说明')
  instructionSheet.columns = [
    { header: '字段名', width: 20 },
    { header: '必填', width: 8 },
    { header: '格式/选项', width: 35 },
    { header: '说明', width: 50 }
  ]

  const instructions = [
    ['=== 主表必填字段 ===', '', '', ''],
    ['预约号码', '是', '字符串', '必须唯一，如：AP-2025001'],
    ['派送方式', '是', '下拉：私仓/自提/直送/卡派', '从下拉列表选择'],
    ['预约账号', '是', '下拉：AA/YTAQ/AYIE/KP/OLPN/DATONG/GG/other', '从下拉列表选择'],
    ['预约类型', '是', '下拉：卡板/地板', '从下拉列表选择'],
    ['起始地', '是', '下拉选择', '从下拉列表选择位置代码，必须存在于位置管理中'],
    ['目的地', '是', '下拉选择', '从下拉列表选择位置代码，必须存在于位置管理中'],
    ['送货时间', '是', '日期时间格式', '格式 YYYY-MM-DD HH:MM，如：2025-12-20 14:30'],
    ['', '', '', ''],
    ['=== 主表选填字段（默认隐藏）===', '', '', ''],
    ['拒收', '否', '下拉：是/否', '默认为"否"'],
    ['PO', '否', '文本', '采购订单号，可留空'],
    ['备注', '否', '文本', '预约备注，可留空'],
    ['', '', '', ''],
    ['=== 明细必填字段 ===', '', '', ''],
    ['订单号', '是', '4位大写字母+7位数字', '如：ABCD1234567，必须存在于订单管理中'],
    ['仓点', '是', '下拉选择', '从下拉列表选择位置代码，必须存在于位置管理中'],
    ['性质', '是', '下拉：AMZ/扣货/已放行/私仓', '从下拉列表选择'],
    ['预计板数', '是', '正整数', '必须大于0'],
    ['', '', '', ''],
    ['重要说明', '', '', ''],
    ['1. 列顺序', '', '', '预约主表必填 → 主表选填 → 明细必填 → 明细选填'],
    ['2. 下拉框', '', '', '所有带下拉的字段点击即可看到选项，防止数据错误'],
    ['3. 位置代码', '', '', '起始地、目的地、仓点都从"位置代码参考"表中选择'],
    ['4. 订单号校验', '', '', '订单号必须存在于订单管理中，并且对应的明细（订单号+仓点+性质）也必须存在'],
    ['5. 板数校验', '', '', '系统会自动校验预计板数是否超过可用板数（已入库/未入库使用不同逻辑）'],
    ['6. 表头颜色', '', '', '红色表头=必填字段，黑色表头=选填字段'],
    ['7. 隐藏列', '', '', 'Excel左上角点击"1"=折叠选填列，点击"2"=展开全部列'],
    ['8. 预填充行', '', '', '已预设200行标准格式，可直接填写。超出200行可复制粘贴'],
    ['9. 主表数据重复', '', '', '同一预约的多个明细，主表字段每行都要填写（系统会自动合并）'],
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

  // ===== 6. 位置代码参考工作表 =====
  const locationSheet = workbook.addWorksheet('位置代码参考')
  locationSheet.columns = [
    { header: '位置代码', key: 'code', width: 15 },
    { header: '位置名称', key: 'name', width: 30 }
  ]
  
  console.log('[预约模板生成] 正在写入位置代码参考表，共', locations.length, '行')
  locations.forEach(location => {
    locationSheet.addRow({
      code: location.location_code,
      name: location.name
    })
  })
  console.log('[预约模板生成] 位置代码参考表写入完成')
  
  locationSheet.getRow(1).font = { bold: true }
  locationSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  }
  locationSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // ===== 7. 返回Workbook =====
  return workbook
}



