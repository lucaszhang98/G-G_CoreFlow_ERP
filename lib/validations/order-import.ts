/**
 * 订单批量导入验证 Schema
 */

import { z } from 'zod'

/**
 * 解析Excel日期（严格验证，引导用户使用正确格式）
 * 
 * 专业做法：
 * 1. 优先接受Excel原生日期格式（数字序列号或Date对象）
 * 2. 只接受标准的YYYY-MM-DD字符串格式
 * 3. 拒绝其他字符串格式，要求用户在Excel中格式化为日期
 */
function parseExcelDate(value: any, fieldName: string = '日期'): { value?: string; error?: string } {
  // 空值处理
  if (!value || value === '') {
    return { value: undefined }
  }
  
  // 1. 优先处理：Date对象（Excel正确读取的日期）
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return { error: `${fieldName}无效，请检查Excel中的日期格式` }
    }
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return { value: `${year}-${month}-${day}` }
  }
  
  // 2. 处理：数字（Excel日期序列号）
  if (typeof value === 'number') {
    // 合理范围检查：Excel日期序列号通常在1-50000之间（1900-2036年）
    if (value < 1 || value > 100000) {
      return { error: `${fieldName}的数值(${value})不是有效的Excel日期序列号` }
    }
    
    // Excel日期从1899年12月30日开始计数
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 86400000)
    
    if (isNaN(date.getTime())) {
      return { error: `${fieldName}转换失败，请在Excel中右键→设置单元格格式→日期` }
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return { value: `${year}-${month}-${day}` }
  }
  
  // 3. 处理：字符串（只接受YYYY-MM-DD标准格式）
  if (typeof value === 'string') {
    const trimmed = value.trim()
    
    // 只接受 YYYY-MM-DD 格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      // 验证日期有效性
      const date = new Date(trimmed)
      if (isNaN(date.getTime())) {
        return { error: `${fieldName}"${trimmed}"不是有效的日期` }
      }
      return { value: trimmed }
    }
    
    // 拒绝其他格式，要求用户修复
    return { 
      error: `${fieldName}格式错误："${trimmed}"不是标准日期格式。
请在Excel中修复：
方法1：选中单元格→右键→设置单元格格式→日期→选任意日期格式（如2001/3/14）
方法2：选中单元格→右键→设置单元格格式→自定义→输入"yyyy-mm-dd"
方法3：点击单元格使用日期选择器（弹出日历）` 
    }
  }
  
  // 其他未知类型
  return { 
    error: `${fieldName}类型错误，请在Excel中将此单元格格式设置为"日期"` 
  }
}

// 订单主表字段验证（Excel中的订单字段）
export const orderImportRowSchema = z.object({
  // ===== 订单主表字段 =====
  order_number: z
    .string()
    .min(1, '订单号不能为空')
    .transform((s) => s.trim())
    .refine((s) => !/\s/.test(s), '柜号不允许包含空格')
    .refine((s) => /^[A-Z]{4}\d{7}$/.test(s), '订单号格式错误，应为4位大写字母+7位数字，如ABCD1234567'),
  
  customer_code: z
    .string()
    .min(1, '客户代码不能为空'),
  
  user_id: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val),
  
  order_date: z
    .any()
    .transform((val) => {
      const result = parseExcelDate(val, '订单日期')
      if (result.error) throw new Error(result.error)
      if (!result.value) throw new Error('订单日期不能为空')
      return result.value
    })
    .pipe(
      z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, '订单日期格式错误')
        .refine((date) => !isNaN(Date.parse(date)), '订单日期无效')
    ),
  
  status: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === '') return 'pending'
      const statusMap: Record<string, string> = {
        '待处理': 'pending',
        '已确认': 'confirmed',
        '已发货': 'shipped',
        '已送达': 'delivered',
        '已取消': 'cancelled',
        '已归档': 'archived',
      }
      return statusMap[val] || val
    }),
  
  operation_mode: z
    .string()
    .min(1, '操作方式不能为空')
    .transform(val => {
      const modeMap: Record<string, string> = {
        '拆柜': 'unload',
        '直送': 'direct_delivery',
      }
      return modeMap[val] || val
    })
    .refine(
      val => val === 'unload' || val === 'direct_delivery',
      '操作方式必须是"拆柜"或"直送"'
    ),
  
  delivery_location_code: z
    .string()
    .min(1, '目的地不能为空'),
  
  total_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform(val => {
      if (val === '' || val === undefined || val === null) return 0
      return typeof val === 'string' ? parseFloat(val) : val
    })
    .refine(val => !isNaN(val as number) && (val as number) >= 0, '订单金额必须是非负数'),
  
  discount_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform(val => {
      if (val === '' || val === undefined || val === null) return 0
      return typeof val === 'string' ? parseFloat(val) : val
    })
    .refine(val => !isNaN(val as number) && (val as number) >= 0, '折扣金额必须是非负数'),
  
  tax_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform(val => {
      if (val === '' || val === undefined || val === null) return 0
      return typeof val === 'string' ? parseFloat(val) : val
    })
    .refine(val => !isNaN(val as number) && (val as number) >= 0, '税费必须是非负数'),
  
  final_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform(val => {
      if (val === '' || val === undefined || val === null) return 0
      return typeof val === 'string' ? parseFloat(val) : val
    })
    .refine(val => !isNaN(val as number) && (val as number) >= 0, '最终金额必须是非负数'),
  
  container_type: z
    .string()
    .min(1, '货柜类型不能为空')
    .refine(
      val => ['40DH', '45DH', '40RH', '45RH', '20GP', '其他'].includes(val),
      '货柜类型必须是40DH/45DH/40RH/45RH/20GP/其他之一'
    ),
  
  eta_date: z
    .any()
    .transform((val) => {
      const result = parseExcelDate(val, 'ETA')
      if (result.error) throw new Error(result.error)
      if (!result.value) throw new Error('ETA不能为空')
      return result.value
    })
    .pipe(
      z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'ETA格式错误')
        .refine((date) => !isNaN(Date.parse(date)), 'ETA无效')
    ),
  
  lfd_date: z
    .any()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const result = parseExcelDate(val, 'LFD')
      if (result.error) throw new Error(result.error)
      return result.value
    })
    .refine(
      val => !val || (/^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val))),
      'LFD格式错误'
    ),
  
  pickup_date: z
    .any()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const result = parseExcelDate(val, '提柜日期')
      if (result.error) throw new Error(result.error)
      return result.value
    })
    .refine(
      val => !val || (/^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val))),
      '提柜日期格式错误'
    ),
  
  ready_date: z
    .any()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const result = parseExcelDate(val, '就绪日期')
      if (result.error) throw new Error(result.error)
      return result.value
    })
    .refine(
      val => !val || (/^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val))),
      '就绪日期格式错误'
    ),
  
  return_deadline: z
    .any()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined
      const result = parseExcelDate(val, '归还截止日期')
      if (result.error) throw new Error(result.error)
      return result.value
    })
    .refine(
      val => !val || (/^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val))),
      '归还截止日期格式错误'
    ),
  
  mbl_number: z
    .string()
    .min(1, 'MBL号码不能为空')
    .max(100, 'MBL号码不能超过100个字符'),
  
  do_issued: z
    .union([z.string(), z.boolean()])
    .transform(val => {
      if (typeof val === 'boolean') return val
      const trueValues = ['是', 'Y', 'y', 'YES', 'yes', 'true', 'TRUE', '1']
      const falseValues = ['否', 'N', 'n', 'NO', 'no', 'false', 'FALSE', '0']
      if (trueValues.includes(val)) return true
      if (falseValues.includes(val)) return false
      throw new Error('DO已签发必须是"是"或"否"')
    }),
  
  notes: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val),
  
  // ===== 订单明细字段 =====
  detail_delivery_location_code: z
    .string()
    .min(1, '送仓地点不能为空'),
  
  delivery_nature: z
    .string()
    .min(1, '送仓性质不能为空')
    .refine(
      val => ['AMZ', '扣货', '已放行', '私仓', '转仓'].includes(val),
      '送仓性质必须是AMZ/扣货/已放行/私仓/转仓之一'
    ),
  
  quantity: z
    .union([z.string(), z.number()])
    .transform(val => typeof val === 'string' ? parseInt(val) : val)
    .refine(val => !isNaN(val) && val > 0, '数量必须是正整数'),
  
  volume: z
    .union([z.string(), z.number()])
    .transform(val => typeof val === 'string' ? parseFloat(val) : val)
    .refine(val => !isNaN(val) && val > 0, '体积必须是正数'),
  
  fba: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val),
  
  detail_notes: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val),
  
  po: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val)
    .refine(val => !val || val.length <= 1000, 'PO长度不能超过1000个字符'),
  
  window_period: z
    .string()
    .optional()
    .transform(val => val === '' ? undefined : val)
    .refine(val => !val || val.length <= 100, '窗口期长度不能超过100个字符'),
})

export type OrderImportRow = z.infer<typeof orderImportRowSchema>

/**
 * 导入错误信息
 */
export interface ImportError {
  row: number // Excel行号（从2开始，因为第1行是表头）
  field?: string // 出错的字段名
  message: string // 错误信息
  value?: any // 错误的值
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean
  total: number // 总行数
  successCount: number // 成功行数
  errorCount: number // 错误行数
  errors: ImportError[] // 错误列表
  createdOrderIds?: string[] // 成功创建的订单ID列表
}

