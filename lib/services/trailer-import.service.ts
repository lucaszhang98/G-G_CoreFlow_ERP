/**
 * 货柜导入Service
 * 
 * 职责：
 * 1. 定义货柜导入的配置
 * 2. 实现货柜导入的业务逻辑
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  trailerImportRowSchema,
  TrailerImportRow,
} from '@/lib/validations/trailer-import'

/**
 * 货柜导入配置
 */
const trailerImportConfig: ImportConfig<TrailerImportRow> = {
  // 1. 表头映射
  headerMap: {
    '货柜代码': 'trailer_code',
    '货柜类型': 'trailer_type',
    '长度(英尺)': 'length_feet',
    '载重': 'capacity_weight',
    '容量': 'capacity_volume',
    '状态': 'status',
    '备注': 'notes',
  },

  // 2. 验证Schema
  validationSchema: trailerImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'tms_manager'],

  // 4. 检查重复
  checkDuplicates: async (data: TrailerImportRow[]): Promise<ImportError[]> => {
    const errors: ImportError[] = []

    // 检查文件内重复
    const codes = data.map((row) => row.trailer_code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)

    if (duplicatesInFile.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatesInFile))
      uniqueDuplicates.forEach((code) => {
        const rowNumbers = data
          .map((r, idx) => (r.trailer_code === code ? idx + 2 : -1))
          .filter((n) => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'trailer_code',
          message: `货柜代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
        })
      })
    }

    // 检查数据库中是否已存在
    if (errors.length === 0) {
      const existingTrailers = await prisma.trailers.findMany({
        where: { trailer_code: { in: codes } },
        select: { trailer_code: true },
      })

      if (existingTrailers.length > 0) {
        const existingCodes = existingTrailers.map((t) => t.trailer_code)
        existingCodes.forEach((code) => {
          const rowIndex = data.findIndex((r) => r.trailer_code === code) + 2
          errors.push({
            row: rowIndex,
            field: 'trailer_code',
            message: `货柜代码 "${code}" 已存在于系统中`,
          })
        })
      }
    }

    return errors
  },

  // 5. 执行导入（核心业务逻辑）
  executeImport: async (
    data: TrailerImportRow[],
    userId: bigint
  ): Promise<void> => {
    // 使用事务确保原子性
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        await tx.trailers.create({
          data: {
            trailer_code: row.trailer_code,
            trailer_type: row.trailer_type,
            length_feet: row.length_feet,
            capacity_weight: row.capacity_weight,
            capacity_volume: row.capacity_volume,
            status: row.status || 'available',
            notes: row.notes,
            created_by: userId,
            updated_by: userId,
          },
        })
      }
    })
  },
}

/**
 * 导出货柜导入Service实例
 */
export const trailerImportService = new BaseImportService(trailerImportConfig)






