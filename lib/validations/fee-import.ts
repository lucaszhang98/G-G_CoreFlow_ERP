/**
 * 费用批量导入验证规则
 */

import { z } from 'zod'

/**
 * 费用导入行数据验证
 */
export const feeImportRowSchema = z.object({
  fee_code: z
    .string({ message: '费用编码为必填项' })
    .min(1, '费用编码不能为空')
    .max(50, '费用编码不能超过50个字符'),

  fee_name: z
    .string({ message: '费用名称为必填项' })
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符'),

  unit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .nullable()
    .transform((val) => (val === null || val === undefined || val === '' ? undefined : val)),

  // Excel 常把数字读成字符串，且可能带空格、千分位逗号等，需统一转成数字并校验
  unit_price: z
    .unknown()
    .transform((v) => {
      if (typeof v === 'number' && !Number.isNaN(v)) return v
      const s = String(v ?? '').trim().replace(/,/g, '')
      if (s === '') throw new Error('单价不能为空')
      const n = Number(s)
      if (Number.isNaN(n)) throw new Error('单价必须是有效数字')
      return n
    })
    .pipe(z.number().min(0, '单价不能为负')),

  currency: z
    .string()
    .max(10)
    .optional()
    .nullable()
    .transform((val) => (val === null || val === undefined || val === '' ? 'USD' : val)),

  scope_type: z.enum(['all', 'customers'], {
    message: '归属范围只能是：all（所有客户）或 customers（指定客户）',
  }),

  container_type: z
    .string()
    .max(50, '柜型不能超过50个字符')
    .optional()
    .nullable()
    .transform((val) => (val === null || val === undefined || val === '' ? null : val)),

  description: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === null || val === undefined || val === '' ? null : val)),
})

export type FeeImportRow = z.infer<typeof feeImportRowSchema>

export interface ImportError {
  row: number
  field?: string
  message: string
  value?: unknown
}

export interface ImportResult {
  success: boolean
  total: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  message?: string
}
