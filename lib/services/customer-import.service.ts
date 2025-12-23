/**
 * 客户导入Service
 * 
 * 职责：
 * 1. 定义客户导入的配置
 * 2. 实现客户导入的业务逻辑
 * 3. 处理客户-联系人的关联创建
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import {
  customerImportRowSchema,
  CustomerImportRow,
} from '@/lib/validations/customer-import'

/**
 * 客户导入配置
 */
const customerImportConfig: ImportConfig<CustomerImportRow> = {
  // 1. 表头映射
  headerMap: {
    '客户代码': 'code',
    '客户名称': 'name',
    '公司名称': 'company_name',
    '状态': 'status',
    '信用额度': 'credit_limit',
    '联系人姓名': 'contact_name',
    '联系人电话': 'contact_phone',
    '联系人邮箱': 'contact_email',
    '联系人地址行1': 'contact_address_line1',
    '联系人地址行2': 'contact_address_line2',
    '联系人城市': 'contact_city',
    '联系人州/省': 'contact_state',
    '联系人邮政编码': 'contact_postal_code',
    '联系人国家': 'contact_country',
  },

  // 2. 验证Schema
  validationSchema: customerImportRowSchema,

  // 3. 权限要求
  requiredRoles: ['admin', 'oms_manager'],

  // 4. 检查重复
  checkDuplicates: async (data: CustomerImportRow[]): Promise<ImportError[]> => {
    const errors: ImportError[] = []

    // 检查文件内重复
    const codes = data.map((row) => row.code)
    const duplicatesInFile = codes.filter((code, index) => codes.indexOf(code) !== index)

    if (duplicatesInFile.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicatesInFile))
      uniqueDuplicates.forEach((code) => {
        const rowNumbers = data
          .map((r, idx) => (r.code === code ? idx + 2 : -1))
          .filter((n) => n > 0)
        errors.push({
          row: rowNumbers[0],
          field: 'code',
          message: `客户代码 "${code}" 在文件中重复（行号：${rowNumbers.join(', ')}）`,
        })
      })
    }

    // 检查数据库中是否已存在
    if (errors.length === 0) {
      const existingCustomers = await prisma.customers.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      })

      if (existingCustomers.length > 0) {
        const existingCodes = existingCustomers.map((c) => c.code)
        existingCodes.forEach((code) => {
          const rowIndex =
            data.findIndex((r) => r.code === code) + 2
          errors.push({
            row: rowIndex,
            field: 'code',
            message: `客户代码 "${code}" 已存在于系统中`,
          })
        })
      }
    }

    return errors
  },

  // 5. 执行导入（核心业务逻辑）
  executeImport: async (
    data: CustomerImportRow[],
    userId: bigint
  ): Promise<void> => {
    // 使用事务确保原子性（全部成功或全部失败）
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        // 创建联系人（如果有联系人信息）
        let contactId: bigint | undefined

        if (row.contact_name || row.contact_phone || row.contact_email) {
          const contact = await tx.contact_roles.create({
            data: {
              related_entity_type: 'customer',
              related_entity_id: BigInt(0), // 临时值，后续更新
              role: 'primary',
              name: row.contact_name || '未命名联系人',
              phone: row.contact_phone,
              email: row.contact_email,
              address_line1: row.contact_address_line1,
              address_line2: row.contact_address_line2,
              city: row.contact_city,
              state: row.contact_state,
              postal_code: row.contact_postal_code,
              country: row.contact_country,
              is_primary: true,
              created_by: userId,
              updated_by: userId,
            },
          })
          contactId = contact.contact_id
        }

        // 创建客户
        const customer = await tx.customers.create({
          data: {
            code: row.code,
            name: row.name,
            company_name: row.company_name,
            status: row.status || 'active',
            credit_limit: row.credit_limit || 0,
            contact_id: contactId,
            created_by: userId,
            updated_by: userId,
          },
        })

        // 更新联系人的 related_entity_id
        if (contactId) {
          await tx.contact_roles.update({
            where: { contact_id: contactId },
            data: { related_entity_id: customer.id },
          })
        }
      }
    })
  },
}

/**
 * 导出客户导入Service实例
 */
export const customerImportService = new BaseImportService(
  customerImportConfig
)





