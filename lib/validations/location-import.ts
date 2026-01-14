/**
 * 位置批量导入验证规则
 */

import { z } from 'zod'

/**
 * 位置导入行数据验证
 */
export const locationImportRowSchema = z.object({
  // 必填字段
  location_code: z.string({ message: '位置代码为必填项' })
    .min(1, '位置代码不能为空')
    .max(50, '位置代码不能超过50个字符')
    .regex(/^[a-zA-Z0-9\-_\.\s]+$/, '位置代码只能包含英文字母、数字和符号（-、_、.、空格），不允许中文'),
  
  name: z.string({ message: '位置名称为必填项' })
    .min(1, '位置名称不能为空')
    .max(200, '位置名称不能超过200个字符'),
  
  location_type: z.enum(['port', 'amazon', 'warehouse'], {
    message: '位置类型只能是：port（码头/查验站）、amazon（亚马逊）、warehouse（仓库）'
  }),
  
  // 选填字段
  address_line1: z.string()
    .max(200, '地址行1不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  address_line2: z.string()
    .max(200, '地址行2不能超过200个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  city: z.string()
    .max(100, '城市不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  state: z.string()
    .max(100, '州/省不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  postal_code: z.string()
    .max(20, '邮政编码不能超过20个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  country: z.string()
    .max(100, '国家不能超过100个字符')
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
  
  notes: z.string()
    .optional()
    .nullable()
    .transform(val => val === null || val === undefined || val === '' ? null : val),
})

export type LocationImportRow = z.infer<typeof locationImportRowSchema>

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
