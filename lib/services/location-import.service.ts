/**
 * 位置导入Service
 * 
 * 职责：
 * 1. 定义位置导入的配置
 * 2. 实现位置导入的业务逻辑
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  locationImportRowSchema,
  LocationImportRow,
} from '@/lib/validations/location-import'

/**
 * 位置导入配置
 */
const locationImportConfig: ImportConfig<LocationImportRow> = {
  // 1. 表头映射
  headerMap: {
    '位置代码': 'location_code',
    '位置名称': 'name',
    '位置类型': 'location_type',
    '地址行1': 'address_line1',
    '地址行2': 'address_line2',
    '城市': 'city',
    '州/省': 'state',
    '邮政编码': 'postal_code',
    '国家': 'country',
    '备注': 'notes',
  },

  // 2. 验证Schema
  validationSchema: locationImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'oms_manager', 'tms_manager', 'wms_manager'],

  // 4. 检查重复
  checkDuplicates: async (data: LocationImportRow[]): Promise<ImportError[]> => {
    const errors: ImportError[] = []

    // 检查文件内重复
    const codes = data.map((row) => row.location_code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)

    if (duplicatesInFile.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatesInFile))
      uniqueDuplicates.forEach((code) => {
        const rowNumbers = data
          .map((r, idx) => (r.location_code === code ? idx + 2 : -1))
          .filter((n) => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'location_code',
          message: `位置代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
        })
      })
    }

    // 检查数据库中是否已存在
    if (errors.length === 0) {
      const existingLocations = await prisma.locations.findMany({
        where: { location_code: { in: codes } },
        select: { location_code: true },
      })

      if (existingLocations.length > 0) {
        const existingCodes = existingLocations.map((l) => l.location_code)
        existingCodes.forEach((code) => {
          const rowIndex = data.findIndex((r) => r.location_code === code) + 2
          errors.push({
            row: rowIndex,
            field: 'location_code',
            message: `位置代码 "${code}" 已存在于系统中`,
          })
        })
      }
    }

    return errors
  },

  // 5. 执行导入（核心业务逻辑）
  executeImport: async (
    data: LocationImportRow[],
    userId: bigint
  ): Promise<void> => {
    // 使用事务确保原子性
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        await tx.locations.create({
          data: {
            location_code: row.location_code,
            name: row.name,
            location_type: row.location_type,
            address_line1: row.address_line1,
            address_line2: row.address_line2,
            city: row.city,
            state: row.state,
            postal_code: row.postal_code,
            country: row.country,
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
 * 导出位置导入Service实例
 */
export const locationImportService = new BaseImportService(locationImportConfig)








