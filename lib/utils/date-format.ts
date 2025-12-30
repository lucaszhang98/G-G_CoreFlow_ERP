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
    /scheduled_load_time/i,
    /actual_load_time/i,
    /load_time/i,
    /pickup_date/i, // 提柜日期需要显示时间
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
 * 注意：使用 UTC 方法避免时区转换问题，直接显示数据库存储的日期
 */
export function formatDateDisplay(value: Date | string | null | undefined): string {
  if (!value) return "-"
  
  // 如果是字符串，尝试直接提取日期部分（YYYY-MM-DD）
  if (typeof value === 'string') {
    // 如果是 YYYY-MM-DD 格式，直接提取
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateMatch) {
      const [, year, month, day] = dateMatch
      return `${month}-${day}`
    }
    // 如果是 ISO 格式（包含 T），提取日期部分
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T/)
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      return `${month}-${day}`
    }
  }
  
  // 如果是 Date 对象，使用 UTC 方法避免时区转换
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return "-"
  
  // 使用 UTC 方法，直接显示数据库存储的日期，不进行时区转换
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${month}-${day}`
}

/**
 * 格式化日期时间显示（不包含年份，节省空间）
 * @param value 日期时间值（Date对象、ISO字符串或datetime-local格式字符串）
 * @returns 格式化的日期时间字符串（MM-DD HH:mm）或 "-"
 * 注意：使用 UTC 方法避免时区转换问题，直接显示数据库存储的时间
 */
export function formatDateTimeDisplay(value: Date | string | null | undefined): string {
  if (!value) return "-"
  
  // 如果是字符串，优先直接解析提取（避免时区转换）
  if (typeof value === 'string') {
    // ISO 格式：2024-11-05T14:30:00.000Z 或 2024-11-05T14:30:00+08:00
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{3})?(Z|[+-]\d{2}:\d{2})?/)
    if (isoMatch) {
      const [, year, month, day, hours, minutes] = isoMatch
      return `${month}-${day} ${hours}:${minutes}`
    }
    // datetime-local 格式：2024-11-05T14:30
    const dateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (dateTimeMatch) {
      const [, year, month, day, hours, minutes] = dateTimeMatch
      return `${month}-${day} ${hours}:${minutes}`
    }
    // 日期时间字符串格式：2024-11-05 14:30:00
    const dateTimeStringMatch = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (dateTimeStringMatch) {
      const [, year, month, day, hours, minutes] = dateTimeStringMatch
      return `${month}-${day} ${hours}:${minutes}`
    }
  }
  
  // 如果是 Date 对象，使用 UTC 方法避免时区转换
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return "-"
  
  // 使用 UTC 方法，直接显示数据库存储的时间，不进行时区转换
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
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

