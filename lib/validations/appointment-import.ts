/**
 * 预约批量导入验证规则
 */
import { z } from 'zod'

/**
 * 预约导入行Schema
 * 
 * 包含预约主表字段 + 明细字段
 */
export const appointmentImportRowSchema = z.object({
  // ===== 预约主表字段 =====
  
  // 预约号码（必填）
  reference_number: z.string({ message: '预约号码为必填项' })
    .min(1, '预约号码不能为空'),
  
  // 订单号（必填，用于关联订单）
  order_number: z.string({ message: '订单号为必填项' })
    .min(1, '订单号不能为空')
    .regex(/^[A-Z]{4}\d{7}$/, '订单号格式错误，应为4位大写字母+7位数字'),
  
  // 派送方式（必填）
  delivery_method: z.enum(['私仓', '自提', '直送', '卡派'], {
    message: '派送方式必须是：私仓、自提、直送、卡派之一',
  }),
  
  // 预约账号（必填）
  appointment_account: z.enum(['AA', 'YTAQ', 'AYIE', 'KP', 'OLPN', 'DATONG', 'GG', 'other'], {
    message: '预约账号必须是：AA、YTAQ、AYIE、KP、OLPN、DATONG、GG、other之一',
  }),
  
  // 预约类型（必填）
  appointment_type: z.enum(['卡板', '地板'], {
    message: '预约类型必须是：卡板、地板之一',
  }),
  
  // 起始地（必填，位置代码）
  origin_location_code: z.string({ message: '起始地为必填项' })
    .min(1, '起始地不能为空'),
  
  // 目的地（必填，位置代码）
  destination_location_code: z.string({ message: '目的地为必填项' })
    .min(1, '目的地不能为空'),
  
  // 送货时间（必填，格式：YYYY-MM-DD HH:mm）
  confirmed_start: z.string({ message: '送货时间为必填项' })
    .min(1, '送货时间不能为空')
    .refine(
      (val) => {
        // 支持多种日期时间格式
        const formats = [
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,  // 2025-12-20 14:30
          /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/, // 2025/12/20 14:30
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,   // 2025-12-20T14:30
        ]
        return formats.some(format => format.test(val))
      },
      '送货时间格式错误，应为 YYYY-MM-DD HH:mm（如：2025-12-20 14:30）'
    ),
  
  // 拒收（选填，默认false）
  rejected: z.union([
    z.boolean(),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') return false
      const normalized = String(val).toLowerCase().trim()
      return normalized === 'true' || normalized === '是' || normalized === '1' || normalized === 'yes'
    })
  ]).optional().nullable().transform(val => val ?? false),
  
  // PO（选填）
  po: z.string().optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
    return val
  }),
  
  // 备注（选填）
  notes: z.string().optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
    return val
  }),
  
  // ===== 预约明细字段 =====
  
  // 仓点（必填，位置代码）
  detail_location_code: z.string({ message: '仓点为必填项' })
    .min(1, '仓点不能为空'),
  
  // 性质（必填）
  delivery_nature: z.enum(['AMZ', '扣货', '已放行', '私仓', '转仓'], {
    message: '性质必须是：AMZ、扣货、已放行、私仓、转仓之一',
  }),
  
  // 预计板数（必填，正整数）
  estimated_pallets: z.union([
    z.number().int().positive('预计板数必须是正整数'),
    z.string().transform(val => {
      if (val === null || val === undefined || val === '') {
        throw new Error('预计板数不能为空')
      }
      const num = parseInt(String(val), 10)
      if (isNaN(num)) {
        throw new Error('预计板数必须是有效数字')
      }
      if (num <= 0) {
        throw new Error('预计板数必须是正整数')
      }
      return num
    })
  ]),
})

export type AppointmentImportRow = z.infer<typeof appointmentImportRowSchema>

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
  message?: string
}





