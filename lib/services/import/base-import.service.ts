/**
 * 通用导入Service基类
 * 
 * 职责：
 * 1. 解析Excel文件
 * 2. 验证数据格式
 * 3. 协调业务逻辑
 * 4. 统一错误处理
 * 
 * 使用方式：
 * const importService = new BaseImportService(config)
 * const result = await importService.import(file, userId)
 */

import * as XLSX from 'xlsx'
import { ImportConfig, ImportResult, ImportError } from './types'

export class BaseImportService<T> {
  constructor(private config: ImportConfig<T>) {}

  /**
   * 执行导入
   * @param file Excel文件
   * @param userId 当前用户ID
   * @returns 导入结果
   */
  async import(file: File, userId: bigint): Promise<ImportResult> {
    try {
      // 1. 读取Excel
      const rawData = await this.parseExcel(file)

      if (rawData.length < 2) {
        return {
          success: false,
          errors: [{ row: 0, field: 'file', message: 'Excel文件中没有数据行' }],
        }
      }

      // 2. 转换数据（表头映射）
      const rows = this.mapRows(rawData, this.config.headerMap)
      console.log(`[导入] 映射后的数据行数: ${rows.length}`)
      console.log(`[导入] 第一行数据示例:`, rows[0])

      // 3. 验证数据
      const { validRows, errors } = await this.validateRows(
        rows,
        this.config.validationSchema
      )

      if (errors.length > 0) {
        return {
          success: false,
          total: rows.length,
          errors: errors.slice(0, 10), // 只返回前10个错误
        }
      }

      // 4. 预加载主数据（如果需要）
      const masterData = this.config.loadMasterData
        ? await this.config.loadMasterData()
        : undefined

      // 5. 检查重复（如果需要）
      if (this.config.checkDuplicates) {
        const duplicateErrors = await this.config.checkDuplicates(validRows, masterData)
        if (duplicateErrors.length > 0) {
          return {
            success: false,
            total: rows.length,
            errors: duplicateErrors.slice(0, 10),
          }
        }
      }

      // 6. 执行导入（业务逻辑）
      const importResult = await this.config.executeImport(validRows, userId, masterData)

      // 如果executeImport返回了自定义的successCount，使用它；否则使用validRows.length
      const importedCount = importResult?.successCount ?? validRows.length

      return {
        success: true,
        imported: importedCount,
        total: rows.length,
      }
    } catch (error: any) {
      console.error('导入失败:', error)
      return {
        success: false,
        errors: [{ row: 0, field: 'system', message: error.message || '导入失败' }],
      }
    }
  }

  /**
   * 解析Excel文件
   * @private
   */
  private async parseExcel(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    console.log('[Excel解析] 所有工作表:', workbook.SheetNames)
    
    // 优先查找包含"数据"或"导入"的工作表，否则使用第一个
    let sheetName = workbook.SheetNames[0]
    const dataSheetName = workbook.SheetNames.find(name => 
      name.includes('数据') || name.includes('导入') || name.includes('预约')
    )
    if (dataSheetName) {
      sheetName = dataSheetName
    }
    
    console.log('[Excel解析] 使用工作表:', sheetName)
    
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    
    console.log('[Excel解析] 解析后的数据行数:', jsonData.length)
    console.log('[Excel解析] 第一行（表头）:', jsonData[0])
    
    return jsonData
  }

  /**
   * 映射数据行（表头映射）
   * @private
   */
  private mapRows(jsonData: any[], headerMap: Record<string, string>): any[] {
    if (!jsonData || jsonData.length === 0) {
      throw new Error('Excel文件为空或格式错误')
    }

    const headers = jsonData[0] as string[]
    if (!headers || headers.length === 0) {
      throw new Error('未找到表头行')
    }

    console.log('[导入映射] Excel表头:', headers)
    console.log('[导入映射] headerMap配置:', Object.keys(headerMap))

    const dataRows = jsonData.slice(1) as any[][]

    let actualRowIndex = 2 // Excel行号从2开始（第1行是表头）
    
    return dataRows
      .filter((row) => row && row.some((cell) => cell !== '' && cell !== null && cell !== undefined)) // 跳过空行
      .map((row) => {
        const obj: any = {}
        headers.forEach((header, index) => {
          const fieldName = headerMap[header]
          if (fieldName) {
            let cellValue = row[index]
            
            // 处理空值
            if (cellValue === null || cellValue === undefined || cellValue === '') {
              obj[fieldName] = ''
              return
            }
            
            // 将所有值转换为字符串（除了已经是字符串的）
            if (typeof cellValue === 'number') {
              // 检查是否是Excel日期序列号（大于1000的数字可能是日期）
              if (cellValue > 1000 && cellValue < 100000) {
                // 可能是Excel日期，转换为日期字符串
                // 注意：Excel序列号是基于本地时间的，我们需要保持原样，不做时区转换
                const excelEpoch = new Date(1899, 11, 30) // Excel的起始日期
                const totalMs = cellValue * 86400000
                const date = new Date(excelEpoch.getTime() + totalMs)
                
                // 使用本地时间方法获取日期组件（保持Excel中的原始值）
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                
                // 如果有小数部分，表示有时间
                if (cellValue % 1 !== 0) {
                  const hours = String(date.getHours()).padStart(2, '0')
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  // 格式化为 YYYY-MM-DD HH:mm
                  obj[fieldName] = `${year}-${month}-${day} ${hours}:${minutes}`
                } else {
                  // 只有日期，格式化为 YYYY-MM-DD
                  obj[fieldName] = `${year}-${month}-${day}`
                }
              } else {
                // 普通数字，转换为字符串
                obj[fieldName] = String(cellValue)
              }
            } else {
              // 已经是字符串或其他类型
              obj[fieldName] = String(cellValue)
            }
          } else {
            console.log(`[导入映射] 未匹配的表头: "${header}"`)
          }
        })
        
        // 自动添加rowIndex（用于错误报告）
        obj.rowIndex = actualRowIndex
        actualRowIndex++
        
        if (actualRowIndex === 3) {
          console.log('[导入映射] 第一行映射结果:', obj)
        }
        
        return obj
      })
  }

  /**
   * 验证数据行
   * @private
   */
  private async validateRows(
    rows: any[],
    schema: any
  ): Promise<{ validRows: T[]; errors: ImportError[] }> {
    const validRows: T[] = []
    const errors: ImportError[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2 // Excel行号（从1开始，且跳过表头）
      const row = rows[i]

      const result = schema.safeParse(row)
      if (result.success) {
        validRows.push(result.data)
      } else {
        // 安全地访问错误信息
        console.log(`[导入验证] 第${rowIndex}行验证失败，错误对象:`, result.error)
        const zodErrors = result.error?.errors || []
        if (zodErrors.length > 0) {
          const firstError = zodErrors[0]
          errors.push({
            row: rowIndex,
            field: firstError.path?.[0]?.toString() || 'unknown',
            message: firstError.message || '验证失败',
          })
        } else {
          // 如果没有具体错误信息，添加一个通用错误
          console.error(`[导入验证] 第${rowIndex}行错误对象异常，完整错误:`, JSON.stringify(result.error))
          errors.push({
            row: rowIndex,
            field: 'unknown',
            message: result.error?.message || '数据验证失败',
          })
        }
      }
    }

    return { validRows, errors }
  }
}




