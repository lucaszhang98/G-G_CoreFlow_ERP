/**
 * Excel 数据转换工具 - 独立可执行版本
 * 
 * 功能：将客户填写的模板转换为订单导入模板格式
 * 
 * 使用方式：
 * 1. 将源文件（客户填写模板）放到 data/ 目录
 * 2. 将模板文件（订单导入模板）放到 templates/ 目录
 * 3. 运行程序，转换后的文件会输出到 output/ 目录
 * 
 * 或者通过命令行参数指定文件路径
 */

import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as readline from 'readline'

// 获取当前文件目录（兼容 ES module 和 CommonJS，以及打包后的 exe）
// 在打包后的 exe 中，使用 process.execPath 获取 exe 文件所在目录
// 在开发环境中，使用 import.meta.url
let baseDir: string
if (process.pkg) {
  // 打包后的 exe：使用 exe 文件所在目录
  baseDir = path.dirname(process.execPath)
} else {
  // 开发环境：使用脚本文件所在目录
  try {
    const __filename = fileURLToPath(import.meta.url)
    baseDir = path.dirname(__filename)
  } catch {
    // 降级方案
    baseDir = path.dirname(process.argv[1] || '.')
  }
}

// 配置路径（相对于 exe 文件所在目录）
const DATA_DIR = path.join(baseDir, 'data')
const TEMPLATES_DIR = path.join(baseDir, 'templates')
const OUTPUT_DIR = path.join(baseDir, 'output')

/**
 * 确保目录存在
 */
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

/**
 * 读取源文件（客户填写模板）
 */
function readSourceFile(filePath: string) {
  console.log(`📂 读取源文件: ${path.basename(filePath)}`)
  
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  
  // 解析基本信息（第2-8行）
  const getValue = (rowIndex: number, colIndex: number = 1): string => {
    const row = jsonData[rowIndex] as any[]
    return (row && row[colIndex]) ? String(row[colIndex]).trim() : ''
  }
  
  const sourceData = {
    customerName: getValue(1),      // 第2行：客户名称
    operationMode: getValue(2),     // 第3行：操作方式
    mbl: getValue(3),              // 第4行：MBL
    orderNumber: getValue(4),       // 第5行：订单号
    containerType: getValue(5),     // 第6行：货柜类型
    destination: getValue(6),      // 第7行：目的地
    eta: getValue(7),              // 第8行：ETA（Excel日期序列号）
  }
  
  console.log('  基本信息:')
  console.log(`    客户名称: ${sourceData.customerName}`)
  console.log(`    订单号: ${sourceData.orderNumber}`)
  console.log(`    操作方式: ${sourceData.operationMode}`)
  console.log(`    货柜类型: ${sourceData.containerType}`)
  console.log(`    MBL: ${sourceData.mbl}`)
  console.log(`    ETA: ${sourceData.eta}`)
  console.log(`    目的地: ${sourceData.destination || '(空)'}`)
  
  // 解析数据行（第11行开始，表头是第10行）
  const headerRowIndex = 9  // 第10行（索引9）
  const headerRow = jsonData[headerRowIndex] as any[]
  
  // 找到各列的索引
  const columnMap: Record<string, number> = {}
  headerRow.forEach((header, idx) => {
    if (header) {
      const headerStr = String(header).trim()
      if (headerStr === '仓库代码') columnMap.deliveryLocation = idx
      if (headerStr === '箱数') columnMap.quantity = idx
      if (headerStr === '体积') columnMap.volume = idx
      if (headerStr === 'FBA') columnMap.fba = idx
      if (headerStr === 'PO') columnMap.po = idx
      if (headerStr === '派送方式') columnMap.deliveryNature = idx
    }
  })
  
  console.log(`\n  列映射:`, columnMap)
  
  // 读取数据行
  const detailRows: Array<{
    deliveryLocation: string
    quantity: number
    volume: number
    fba: string
    po: string
    deliveryNature: string
  }> = []
  
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[]
    const deliveryLocation = columnMap.deliveryLocation !== undefined ? String(row[columnMap.deliveryLocation] || '').trim() : ''
    
    // 如果送仓地点为空，跳过这一行
    if (!deliveryLocation) continue
    
    const quantity = columnMap.quantity !== undefined ? parseFloat(String(row[columnMap.quantity] || 0)) : 0
    const volume = columnMap.volume !== undefined ? parseFloat(String(row[columnMap.volume] || 0)) : 0
    const fba = columnMap.fba !== undefined ? String(row[columnMap.fba] || '').trim() : ''
    const po = columnMap.po !== undefined ? String(row[columnMap.po] || '').trim() : ''
    const deliveryNature = columnMap.deliveryNature !== undefined ? String(row[columnMap.deliveryNature] || '').trim() : ''
    
    detailRows.push({
      deliveryLocation,
      quantity,
      volume,
      fba,
      po,
      deliveryNature,
    })
  }
  
  console.log(`\n  数据行数: ${detailRows.length}`)
  
  return { sourceData, detailRows }
}

/**
 * 按送仓地点汇总数据
 */
function aggregateByDeliveryLocation(detailRows: Array<{
  deliveryLocation: string
  quantity: number
  volume: number
  fba: string
  po: string
  deliveryNature: string
}>) {
  const aggregated = new Map<string, {
    deliveryLocation: string
    quantity: number
    volume: number
    fbaList: string[]
    poList: string[]
    deliveryNature: string
  }>()
  
  for (const row of detailRows) {
    const key = row.deliveryLocation
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        deliveryLocation: row.deliveryLocation,
        quantity: 0,
        volume: 0,
        fbaList: [],
        poList: [],
        deliveryNature: row.deliveryNature || 'AMZ', // 默认值
      })
    }
    
    const item = aggregated.get(key)!
    item.quantity += row.quantity
    item.volume += row.volume
    if (row.fba) item.fbaList.push(row.fba)
    if (row.po) item.poList.push(row.po)
  }
  
  return Array.from(aggregated.values())
}

/**
 * 日期对象转Excel日期序列号（只保留年月日，不包含时间）
 */
function dateToExcelSerial(date: Date): number {
  const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
  // 只使用年月日，忽略时间部分
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = dateOnly.getTime() - excelEpoch.getTime()
  const serial = diffMs / (24 * 60 * 60 * 1000)
  return Math.floor(serial) // 只保留整数部分（日期），去掉小数部分（时间）
}

/**
 * 读取模板文件
 */
async function readTemplateFile(filePath: string): Promise<ExcelJS.Workbook> {
  console.log(`\n📂 读取模板文件: ${path.basename(filePath)}`)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  return workbook
}

/**
 * 写入转换后的数据
 */
async function writeOutputFile(
  templateWorkbook: ExcelJS.Workbook,
  sourceData: {
    customerName: string
    operationMode: string
    mbl: string
    orderNumber: string
    containerType: string
    destination: string
    eta: string
  },
  aggregatedRows: Array<{
    deliveryLocation: string
    quantity: number
    volume: number
    fbaList: string[]
    poList: string[]
    deliveryNature: string
  }>,
  outputPath: string
) {
  console.log(`\n📝 写入输出文件: ${path.basename(outputPath)}`)
  
  // 获取模板工作表
  const templateSheet = templateWorkbook.getWorksheet('订单导入模板')
  if (!templateSheet) {
    throw new Error('找不到"订单导入模板"工作表')
  }
  
  // 获取表头行（第1行）
  const headerRow = templateSheet.getRow(1)
  
  // 找到各列的索引
  const columnMap: Record<string, number> = {}
  headerRow.eachCell((cell, colNumber) => {
    const header = cell.value?.toString() || ''
    if (header === '订单号') columnMap.orderNumber = colNumber
    if (header === '客户代码') columnMap.customerCode = colNumber
    if (header === '订单日期') columnMap.orderDate = colNumber
    if (header === '操作方式') columnMap.operationMode = colNumber
    if (header === '目的地') columnMap.destination = colNumber
    if (header === '货柜类型') columnMap.containerType = colNumber
    if (header === 'ETA') columnMap.eta = colNumber
    if (header === 'MBL') columnMap.mbl = colNumber
    if (header === 'DO') columnMap.do = colNumber
    if (header === '送仓地点') columnMap.deliveryLocation = colNumber
    if (header === '性质') columnMap.deliveryNature = colNumber
    if (header === '数量') columnMap.quantity = colNumber
    if (header === '体积') columnMap.volume = colNumber
    if (header === 'FBA') columnMap.fba = colNumber
    if (header === 'PO') columnMap.po = colNumber
  })
  
  console.log(`  列映射:`, columnMap)
  
  // 确定目的地
  const destination = sourceData.operationMode === '拆柜' ? 'GG' : sourceData.destination
  
  // 转换ETA日期（使用Excel日期序列号，只保留年月日，不进行时区转换）
  let etaSerial: number
  if (sourceData.eta) {
    const etaSerialValue = parseFloat(sourceData.eta)
    if (!isNaN(etaSerialValue)) {
      // 如果源数据已经是序列号，只保留整数部分（去掉时间）
      etaSerial = Math.floor(etaSerialValue)
    } else {
      // 如果无法解析，使用今天的日期序列号
      const today = new Date()
      etaSerial = dateToExcelSerial(today)
    }
  } else {
    const today = new Date()
    etaSerial = dateToExcelSerial(today)
  }
  
  // 订单日期（今天，使用Excel日期序列号，只保留年月日，不进行时区转换）
  const today = new Date()
  const orderDateSerial = dateToExcelSerial(today)
  
  // 清空模板数据（从第2行开始）
  let dataRowIndex = 2
  while (templateSheet.getRow(dataRowIndex).getCell(1).value) {
    const row = templateSheet.getRow(dataRowIndex)
    Object.values(columnMap).forEach(colNum => {
      row.getCell(colNum).value = null
    })
    dataRowIndex++
  }
  
  // 写入数据（从第2行开始）
  dataRowIndex = 2
  for (const rowData of aggregatedRows) {
    const row = templateSheet.getRow(dataRowIndex)
    
    // 订单级别字段（每行都相同）
    if (columnMap.orderNumber) row.getCell(columnMap.orderNumber).value = sourceData.orderNumber
    if (columnMap.customerCode) row.getCell(columnMap.customerCode).value = sourceData.customerName
    if (columnMap.orderDate) {
      const orderDateCell = row.getCell(columnMap.orderDate)
      orderDateCell.value = orderDateSerial // 使用Excel日期序列号（数字），不进行时区转换
      orderDateCell.numFmt = 'yyyy-mm-dd' // 设置日期格式，只显示年月日
    }
    if (columnMap.operationMode) row.getCell(columnMap.operationMode).value = sourceData.operationMode
    if (columnMap.destination) row.getCell(columnMap.destination).value = destination
    if (columnMap.containerType) row.getCell(columnMap.containerType).value = sourceData.containerType
    if (columnMap.eta) {
      const etaCell = row.getCell(columnMap.eta)
      etaCell.value = etaSerial // 使用Excel日期序列号（数字），不进行时区转换
      etaCell.numFmt = 'yyyy-mm-dd' // 设置日期格式，只显示年月日
    }
    if (columnMap.mbl) row.getCell(columnMap.mbl).value = sourceData.mbl
    if (columnMap.do) row.getCell(columnMap.do).value = '否' // DO字段默认为"否"
    
    // 明细级别字段
    if (columnMap.deliveryLocation) row.getCell(columnMap.deliveryLocation).value = rowData.deliveryLocation
    if (columnMap.deliveryNature) row.getCell(columnMap.deliveryNature).value = rowData.deliveryNature
    if (columnMap.quantity) row.getCell(columnMap.quantity).value = Math.round(rowData.quantity)
    if (columnMap.volume) row.getCell(columnMap.volume).value = Math.round(rowData.volume * 100) / 100 // 保留2位小数
    if (columnMap.fba) row.getCell(columnMap.fba).value = rowData.fbaList.join('\n')
    if (columnMap.po) row.getCell(columnMap.po).value = rowData.poList.join('\n')
    
    dataRowIndex++
  }
  
  console.log(`  写入 ${aggregatedRows.length} 行数据`)
  
  // 保存文件
  await templateWorkbook.xlsx.writeFile(outputPath)
  console.log(`  ✅ 文件已保存`)
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Excel 数据转换工具')
  console.log('='.repeat(60))
  
  try {
    // 确保目录存在
    ensureDirectories()
    
    // 1. 查找源文件
    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    if (dataFiles.length === 0) {
      console.log(`\n❌ data/ 目录中没有找到源文件`)
      console.log(`\n📋 使用说明:`)
      console.log(`  1. 将客户填写的模板文件放到 data/ 目录`)
      console.log(`  2. 将订单导入模板文件放到 templates/ 目录`)
      console.log(`  3. 重新运行程序`)
      console.log(`\n按任意键退出...`)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.on('data', () => process.exit(0))
      return
    }
    if (dataFiles.length > 1) {
      console.log(`\n⚠️  警告: data/ 目录中有多个文件，将处理第一个: ${dataFiles[0]}`)
    }
    const sourceFilePath = path.join(DATA_DIR, dataFiles[0])
    
    // 2. 查找模板文件（优先在 templates/，其次在 output/）
    let templateFiles: string[] = []
    if (fs.existsSync(TEMPLATES_DIR)) {
      templateFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    }
    if (templateFiles.length === 0) {
      templateFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    }
    if (templateFiles.length === 0) {
      console.log(`\n❌ 没有找到模板文件`)
      console.log(`\n📋 使用说明:`)
      console.log(`  请将订单导入模板文件放到 templates/ 目录`)
      console.log(`\n按任意键退出...`)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.on('data', () => process.exit(0))
      return
    }
    if (templateFiles.length > 1) {
      console.log(`\n⚠️  警告: 找到多个模板文件，将使用第一个: ${templateFiles[0]}`)
    }
    const templateFilePath = templateFiles[0].includes(path.sep) 
      ? templateFiles[0] 
      : (fs.existsSync(path.join(TEMPLATES_DIR, templateFiles[0]))
          ? path.join(TEMPLATES_DIR, templateFiles[0])
          : path.join(OUTPUT_DIR, templateFiles[0]))
    
    // 3. 读取源文件
    const { sourceData, detailRows } = readSourceFile(sourceFilePath)
    
    // 4. 按送仓地点汇总
    console.log(`\n📊 按送仓地点汇总数据...`)
    const aggregatedRows = aggregateByDeliveryLocation(detailRows)
    console.log(`  汇总后行数: ${aggregatedRows.length}`)
    aggregatedRows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.deliveryLocation}: 数量=${row.quantity}, 体积=${row.volume}, FBA=${row.fbaList.length}个, PO=${row.poList.length}个`)
    })
    
    // 5. 读取模板文件
    const templateWorkbook = await readTemplateFile(templateFilePath)
    
    // 6. 生成输出文件名
    const sourceFileName = path.basename(sourceFilePath, '.xlsx')
    const outputFileName = `${sourceFileName}_转换结果_${new Date().toISOString().split('T')[0]}.xlsx`
    const outputPath = path.join(OUTPUT_DIR, outputFileName)
    
    // 7. 写入输出文件
    await writeOutputFile(templateWorkbook, sourceData, aggregatedRows, outputPath)
    
    console.log(`\n✅ 转换完成！`)
    console.log(`   输出文件: ${outputFileName}`)
    console.log(`   文件位置: ${outputPath}`)
    console.log(`\n按任意键退出...`)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', () => process.exit(0))
    
  } catch (error) {
    console.error('\n❌ 转换失败:', error)
    console.log(`\n按任意键退出...`)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', () => process.exit(1))
  }
}

// 运行转换
main().catch(console.error)
