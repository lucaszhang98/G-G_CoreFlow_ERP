/**
 * 货柜批量导入验证规则
 */
import { z } from 'zod'

export const trailerImportRowSchema = z.object({
  // 必填字段
  trailer_code: z.string({ message: '货柜代码为必填项' })
    .min(1, '货柜代码不能为空')
    .max(50, '货柜代码不能超过50个字符'),
  
  trailer_type: z.string({ message: '货柜类型为必填项' })
    .min(1, '货柜类型不能为空')
    .max(50, '货柜类型不能超过50个字符'),
  
  // 选填字段
  length_feet: z.union([
    z.number(),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') return null
      const num = parseFloat(String(val))
      if (isNaN(num)) throw new Error('长度必须是有效数字')
      if (num < 0) throw new Error('长度不能为负数')
      return num
    })
  ]).optional().nullable().transform(val => val === null || val === undefined ? null : val),
  
  capacity_weight: z.union([
    z.number(),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') return null
      const num = parseFloat(String(val))
      if (isNaN(num)) throw new Error('载重必须是有效数字')
      if (num < 0) throw new Error('载重不能为负数')
      return num
    })
  ]).optional().nullable().transform(val => val === null || val === undefined ? null : val),
  
  capacity_volume: z.union([
    z.number(),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') return null
      const num = parseFloat(String(val))
      if (isNaN(num)) throw new Error('容量必须是有效数字')
      if (num < 0) throw new Error('容量不能为负数')
      return num
    })
  ]).optional().nullable().transform(val => val === null || val === undefined ? null : val),
  
  status: z.union([
    z.enum(['available', 'in_use', 'maintenance', 'retired']),
    z.string(),
    z.null(),
    z.undefined()
  ])
    .optional()
    .nullable()
    .transform(val => {
      if (val === null || val === undefined || val === '') return 'available'
      const normalized = String(val).toLowerCase().trim()
      if (['available', 'in_use', 'maintenance', 'retired'].includes(normalized)) {
        return normalized as 'available' | 'in_use' | 'maintenance' | 'retired'
      }
      return 'available' // 默认返回 available
    }) as z.ZodType<'available' | 'in_use' | 'maintenance' | 'retired'>,
  
  notes: z.string().optional().nullable().transform(val => val === null || val === undefined || val === '' ? null : val),
})

export type TrailerImportRow = z.infer<typeof trailerImportRowSchema>

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
