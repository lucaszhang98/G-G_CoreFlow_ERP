/**
 * 司机导入Service
 * 
 * 职责：
 * 1. 定义司机导入的配置
 * 2. 实现司机导入的业务逻辑
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  driverImportRowSchema,
  DriverImportRow,
} from '@/lib/validations/driver-import'

/**
 * 司机导入配置
 */
const driverImportConfig: ImportConfig<DriverImportRow> = {
  // 1. 表头映射
  headerMap: {
    '司机代码': 'driver_code',
    '驾驶证号': 'license_number',
    '车牌号': 'license_plate',
    '承运商代码': 'carrier_code',
    '联系人姓名': 'contact_name',
    '联系电话': 'contact_phone',
    '联系邮箱': 'contact_email',
    '驾驶证到期日': 'license_expiration',
    '状态': 'status',
    '备注': 'notes',
  },

  // 2. 验证Schema
  validationSchema: driverImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'tms_manager'],

  // 4. 检查重复
  checkDuplicates: async (data: DriverImportRow[]): Promise<ImportError[]> => {
    const errors: ImportError[] = []

    // 检查文件内重复 - 司机代码
    const codes = data.map((row) => row.driver_code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)

    if (duplicatesInFile.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatesInFile))
      uniqueDuplicates.forEach((code) => {
        const rowNumbers = data
          .map((r, idx) => (r.driver_code === code ? idx + 2 : -1))
          .filter((n) => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'driver_code',
          message: `司机代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
        })
      })
    }

    // 检查数据库中是否已存在
    if (errors.length === 0) {
      const existingDrivers = await prisma.drivers.findMany({
        where: { driver_code: { in: codes } },
        select: { driver_code: true },
      })

      if (existingDrivers.length > 0) {
        const existingCodes = existingDrivers.map((d) => d.driver_code)
        existingCodes.forEach((code) => {
          const rowIndex = data.findIndex((r) => r.driver_code === code) + 2
          errors.push({
            row: rowIndex,
            field: 'driver_code',
            message: `司机代码 "${code}" 已存在于系统中`,
          })
        })
      }
    }

    return errors
  },

  // 5. 执行导入（核心业务逻辑）
  executeImport: async (
    data: DriverImportRow[],
    userId: bigint
  ): Promise<void> => {
    // 使用事务确保原子性
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        // 查找承运商ID（如果提供了承运商代码）
        let carrierId: bigint | null = null
        if (row.carrier_code) {
          const carrier = await tx.carriers.findFirst({
            where: { carrier_code: row.carrier_code },
            select: { carrier_id: true },
          })
          if (!carrier) {
            throw new Error(`承运商代码 "${row.carrier_code}" 不存在`)
          }
          carrierId = carrier.carrier_id
        }

        // 创建或查找联系人（如果提供了联系人信息）
        let contactId: bigint | null = null
        if (row.contact_name) {
          const contact = await tx.contact_roles.create({
            data: {
              name: row.contact_name,
              phone: row.contact_phone || null,
              email: row.contact_email || null,
              created_by: userId,
              updated_by: userId,
            },
          })
          contactId = contact.contact_id
        }

        // 创建司机
        await tx.drivers.create({
          data: {
            driver_code: row.driver_code,
            license_number: row.license_number,
            license_plate: row.license_plate,
            carrier_id: carrierId,
            contact_id: contactId,
            license_expiration: row.license_expiration ? new Date(row.license_expiration) : null,
            status: row.status || 'active',
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
 * 导出司机导入Service实例
 */
export const driverImportService = new BaseImportService(driverImportConfig)

