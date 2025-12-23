/**
 * 打印模板通用工具和常量
 * 
 * 由于各单据差异较大（横排/竖排、A4/4×6），只提炼真正通用的部分：
 * 1. 页面尺寸常量
 * 2. 通用工具函数
 * 3. 基础类型定义
 */

/**
 * 页面尺寸配置（毫米）
 */
export const PageSizes = {
  A4_PORTRAIT: {
    width: 210,
    height: 297,
  },
  A4_LANDSCAPE: {
    width: 297,
    height: 210,
  },
  LABEL_4X6_PORTRAIT: {
    width: 101.6, // 4 inches = 101.6mm
    height: 152.4, // 6 inches = 152.4mm
  },
  LABEL_4X6_LANDSCAPE: {
    width: 152.4, // 6 inches = 152.4mm (横向)
    height: 101.6, // 4 inches = 101.6mm (横向)
  },
} as const

/**
 * 通用日期格式化工具
 * 修复时区问题：如果输入是日期字符串（YYYY-MM-DD），直接解析，避免时区转换导致日期偏移
 */
export function formatDate(date: Date | string | null | undefined, format: 'short' | 'long' = 'short'): string {
  if (!date) return '-'
  
  // 如果是字符串格式的日期（YYYY-MM-DD），直接解析年月日，避免时区问题
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const dateStr = date.split('T')[0] // 只取日期部分，忽略时间
    const [year, month, day] = dateStr.split('-').map(Number)
    
    if (format === 'short') {
      return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    } else {
      // 如果有时间部分，也解析出来
      const timePart = date.includes('T') ? date.split('T')[1].split('.')[0] : null
      if (timePart) {
        const [hour, minute] = timePart.split(':').map(Number)
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      }
      return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    }
  }
  
  // 如果是 Date 对象或其他格式，使用原来的逻辑
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  if (format === 'short') {
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } else {
    return d.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

/**
 * 通用数字格式化工具
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return '-'
  return value.toFixed(decimals)
}

/**
 * 公司信息（可选，如果需要显示公司Logo等信息）
 */
export interface CompanyInfo {
  name?: string
  logo?: string // Logo URL 或 base64
  address?: string
  phone?: string
  email?: string
}

/**
 * 获取公司信息（可以从系统配置或环境变量读取）
 */
export function getCompanyInfo(): CompanyInfo {
  // TODO: 从数据库或配置文件读取
  return {
    name: process.env.COMPANY_NAME || 'G&G CoreFlow ERP',
    address: process.env.COMPANY_ADDRESS,
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL,
  }
}


