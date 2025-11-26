/**
 * 统一的日期格式化框架
 * 所有表格中的日期和时间戳都会自动使用不包含年份的格式显示
 */

/**
 * 检测字段是否为日期类型
 */
export function isDateField(fieldKey: string, value: any): boolean {
  // 通过字段名判断
  const dateFieldPatterns = [
    /date/i,
    /time/i,
    /created_at/i,
    /updated_at/i,
    /_at$/i, // 以 _at 结尾的字段
  ]
  
  const isDateFieldName = dateFieldPatterns.some(pattern => pattern.test(fieldKey))
  
  if (!isDateFieldName) return false
  
  // 通过值类型判断
  if (value === null || value === undefined) return false
  
  // 如果是 Date 对象
  if (value instanceof Date) return true
  
  // 如果是字符串，尝试解析
  if (typeof value === 'string') {
    // 检查是否是 ISO 日期格式或 YYYY-MM-DD 格式
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/
    if (isoDatePattern.test(value)) {
      const date = new Date(value)
      return !isNaN(date.getTime())
    }
  }
  
  return false
}

/**
 * 检测字段是否为时间戳类型（包含时间部分）
 */
export function isDateTimeField(fieldKey: string, value: any): boolean {
  if (!isDateField(fieldKey, value)) return false
  
  // 时间戳相关的字段名
  const dateTimeFieldPatterns = [
    /time/i,
    /timestamp/i,
    /appointment_time/i,
    /requested_start/i,
    /requested_end/i,
    /confirmed_start/i,
    /confirmed_end/i,
  ]
  
  const isDateTimeFieldName = dateTimeFieldPatterns.some(pattern => pattern.test(fieldKey))
  
  if (isDateTimeFieldName) return true
  
  // 通过值判断：如果包含时间部分（有 T 或包含时分秒），则是时间戳
  if (typeof value === 'string') {
    return value.includes('T') || / \d{2}:\d{2}/.test(value)
  }
  
  if (value instanceof Date) {
    // 如果有时间部分（不是 00:00:00），则是时间戳
    return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0
  }
  
  return false
}

/**
 * 格式化日期显示（不包含年份，节省空间）
 * @param value 日期值（Date对象、ISO字符串或YYYY-MM-DD格式字符串）
 * @returns 格式化的日期字符串（MM-DD）或 "-"
 */
export function formatDateDisplay(value: Date | string | null | undefined): string {
  if (!value) return "-"
  
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return "-"
  
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

/**
 * 格式化日期时间显示（不包含年份，节省空间）
 * @param value 日期时间值（Date对象、ISO字符串或datetime-local格式字符串）
 * @returns 格式化的日期时间字符串（MM-DD HH:mm）或 "-"
 */
export function formatDateTimeDisplay(value: Date | string | null | undefined): string {
  if (!value) return "-"
  
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return "-"
  
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

/**
 * 自动格式化日期字段值
 * 根据字段名和值自动判断是日期还是时间戳，并应用相应的格式化
 */
export function autoFormatDateField(fieldKey: string, value: any): string {
  if (!isDateField(fieldKey, value)) {
    return value?.toString() || "-"
  }
  
  if (isDateTimeField(fieldKey, value)) {
    return formatDateTimeDisplay(value)
  }
  
  return formatDateDisplay(value)
}

