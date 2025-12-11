/**
 * 日期时间处理工具
 * 
 * 核心原则：
 * 1. 系统统一使用 UTC 时区（与 Neon DB 保持一致）
 * 2. 用户输入的时间直接当作 UTC 时间处理，不做任何时区转换
 * 3. 不管用户在哪里（北京、南美、北欧），输入的时间都当作 UTC 时间
 * 4. 数据库存储和读取都直接使用 UTC，不做转换
 * 
 * 示例：
 * - 用户在北京输入 "2025-11-12T08:00"，系统当作 UTC 的 08:00，直接存储
 * - 从数据库读取 "2025-11-12T08:00:00.000Z"，直接显示为 "2025-11-12T08:00"
 */

/**
 * 将时间字符串解析为 Date 对象（UTC 时间）
 * 
 * 用户输入：'2025-11-12T08:00' 
 * 解析为：UTC 时间的 Date 对象（直接存储，不做时区转换）
 * 
 * @param dateTimeString - 时间字符串，格式：'YYYY-MM-DDTHH:mm' 或 'YYYY-MM-DDTHH:mm:ss'
 * @returns Date 对象（UTC 时间戳）
 */
export function parseDateTimeAsUTC(dateTimeString: string): Date {
  if (!dateTimeString) {
    throw new Error('时间字符串不能为空')
  }

  // 解析时间字符串
  const match = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?$/)
  if (!match) {
    throw new Error(`无效的时间格式: ${dateTimeString}，期望格式: YYYY-MM-DDTHH:mm`)
  }

  const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = match
  
  // 直接使用 UTC 方法创建 Date 对象，不做任何时区转换
  // 用户输入什么时间，就当作 UTC 的什么时间
  return new Date(Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10),
    parseInt(milliseconds, 10)
  ))
}

/**
 * 将 UTC 时间戳格式化为时间字符串（用于显示）
 * 
 * 数据库存储：UTC 时间戳（例如：2025-11-12T08:00:00.000Z）
 * 转换为：'2025-11-12T08:00' (直接显示 UTC 时间，不做时区转换)
 * 
 * @param utcDate - UTC 时间戳（Date 对象或 ISO 字符串）
 * @returns 时间字符串，格式：'YYYY-MM-DDTHH:mm'
 */
export function formatUTCDateTimeString(utcDate: Date | string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('无效的日期')
  }
  
  // 直接使用 UTC 方法格式化，不做任何时区转换
  // 数据库存的是什么 UTC 时间，就显示什么时间
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

