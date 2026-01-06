/**
 * 司机批量导入验证规则
 */
import { z } from 'zod'

export const driverImportRowSchema = z.object({
  // 必填字段
  driver_code: z.string({ message: '司机代码为必填项' })
    .min(1, '司机代码不能为空')
    .max(50, '司机代码不能超过50个字符'),
  
  license_number: z.string({ message: '驾驶证号为必填项' })
    .min(1, '驾驶证号不能为空')
    .max(100, '驾驶证号不能超过100个字符'),
  
  license_plate: z.string({ message: '车牌号为必填项' })
    .min(1, '车牌号不能为空')
    .max(10, '车牌号不能超过10个字符'),
  
  // 选填字段
  carrier_code: z.string().optional().nullable().transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_name: z.string().optional().nullable().transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_phone: z.string().optional().nullable().transform(val => val === null || val === undefined || val === '' ? null : val),
  
  contact_email: z.string()
    .optional()
    .nullable()
    .transform(val => {
      if (val === null || val === undefined || val === '') return null
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(val))) {
        throw new Error('邮箱格式不正确')
      }
      return val
    }),
  
  license_expiration: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD'),
    z.date(),
    z.null(),
    z.undefined()
  ])
    .optional()
    .nullable()
    .transform(val => {
      if (val === null || val === undefined || val === '') return null
      if (val instanceof Date) return val.toISOString().split('T')[0]
      return val
    }),
  
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
      if (['active', 'inactive'].includes(normalized)) {
        return normalized as 'active' | 'inactive'
      }
      return 'active' // 默认返回 active
    }) as z.ZodType<'active' | 'inactive'>,
  
  notes: z.string().optional().nullable().transform(val => val === null || val === undefined || val === '' ? null : val),
})

export type DriverImportRow = z.infer<typeof driverImportRowSchema>

export interface ImportError {
  row: number
  field?: string
  message: string
  value?: any
}

export interface ImportResult {
  success: boolean
  total: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  message: string
}

