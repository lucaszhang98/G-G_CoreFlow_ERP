/**
 * 费用批量导入 Service
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import { feeImportRowSchema, FeeImportRow } from '@/lib/validations/fee-import'

const feeImportConfig: ImportConfig<FeeImportRow> = {
  headerMap: {
    '费用编码': 'fee_code',
    '费用名称': 'fee_name',
    '单位': 'unit',
    '单价': 'unit_price',
    '币种': 'currency',
    '归属范围': 'scope_type',
    '说明': 'description',
    '排序': 'sort_order',
    '启用': 'is_active',
  },

  validationSchema: feeImportRowSchema,

  requiredRoles: ['admin', 'oms_manager'],

  executeImport: async (data: FeeImportRow[], userId: bigint): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      for (const row of data) {
        await tx.fee.create({
          data: {
            fee_code: row.fee_code,
            fee_name: row.fee_name,
            unit: row.unit ?? null,
            unit_price: row.unit_price,
            currency: row.currency ?? 'USD',
            scope_type: row.scope_type,
            description: row.description ?? null,
            sort_order: row.sort_order ?? 0,
            is_active: row.is_active ?? true,
            created_by: userId,
            updated_by: userId,
          },
        })
      }
    })
  },
}

export const feeImportService = new BaseImportService(feeImportConfig)
