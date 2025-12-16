/**
 * 客户批量导入验证规则
 */

import { z } from 'zod'

/**
 * 客户导入行数据验证（包含联系人信息）
 */
export const customerImportRowSchema = z.object({
  // 必填字段
  code: z.string({ message: '客户代码为必填项' })
    .min(1, '客户代码不能为空')
    .max(50, '客户代码不能超过50个字符')
    .regex(/^[A-Z0-9_-]+$/, '客户代码只能包含大写字母、数字、下划线和连字符'),
  
  name: z.string({ message: '客户名称为必填项' })
    .min(1, '客户名称不能为空')
    .max(200, '客户名称不能超过200个字符'),
  
  // 选填字段 - 客户基本信息
  company_name: z.string()
    .max(200, '公司名称不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  status: z.union([
    z.enum(['active', 'inactive']),
    z.string(),
    z.null(),
    z.undefined()
  ])
    .optional()
    .nullable()
    .transform(val => {
      if (val === null || val === undefined || val === '') return 'active'
      const normalized = String(val).toLowerCase().trim()
      if (normalized === 'active' || normalized === '活跃') return 'active'
      if (normalized === 'inactive' || normalized === '停用') return 'inactive'
      return 'active' // 默认返回 active
    }) as z.ZodType<'active' | 'inactive'>,
  
  credit_limit: z.union([
    z.number(),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') return 0
      const num = parseFloat(String(val))
      if (isNaN(num)) throw new Error('信用额度必须是有效数字')
      if (num < 0) throw new Error('信用额度不能为负数')
      return num
    })
  ])
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined ? 0 : val),
  
  // 选填字段 - 联系人信息
  contact_name: z.string()
    .max(100, '联系人姓名不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_phone: z.string()
    .max(50, '联系人电话不能超过50个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_email: z.string()
    .email('联系人邮箱格式不正确')
    .max(200, '联系人邮箱不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val)
    .catch(null), // 如果邮箱为空，捕获错误并返回null
  
  contact_address_line1: z.string()
    .max(200, '联系人地址行1不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_address_line2: z.string()
    .max(200, '联系人地址行2不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_city: z.string()
    .max(100, '联系人城市不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_state: z.string()
    .max(100, '联系人州/省不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_postal_code: z.string()
    .max(20, '联系人邮政编码不能超过20个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_country: z.string()
    .max(100, '联系人国家不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
})

export type CustomerImportRow = z.infer<typeof customerImportRowSchema>

/**
 * 导入错误信息
 */
export interface ImportError {
  row: number
  field?: string
  message: string
  value?: any
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean
  total: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  message: string
}
