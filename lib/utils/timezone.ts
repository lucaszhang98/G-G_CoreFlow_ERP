/**
 * 时区工具函数
 * 
 * 核心原则：
 * 1. 系统内部统一使用一个时区（约定为 PST/PDT，但实际可以是任何时区）
 * 2. 不读取外界时间，所有时间都应该是用户输入或系统内部约定的
 * 3. 不做时区转换，用户输入什么时间，就存储什么时间，显示什么时间
 * 
 * 使用场景：
 * - 日期字符串格式化：将日期字符串格式化为 YYYY-MM-DD
 * - 日期比较：比较两个日期字符串
 * - 日期计算：在日期字符串基础上加减天数
 * 
 * ⚠️ 注意：这些函数不获取当前时间，只处理已存在的日期数据
 * 
 * 🌍 夏令时/冬令时处理：
 * - 'America/Los_Angeles' 时区标识符会自动处理 PST（太平洋标准时间，UTC-8）和 PDT（太平洋夏令时，UTC-7）的切换
 * - PostgreSQL 和 JavaScript 的时区库会根据日期自动应用正确的时区偏移
 * - 夏令时通常在 3 月第二个星期日开始，11 月第一个星期日结束
 * - 系统无需手动干预，时区库会自动处理切换
 */

/**
 * 系统统一时区（PST/PDT - 太平洋时区）
 * 
 * 时区说明：
 * - PST (Pacific Standard Time): 冬令时，UTC-8，通常在 11 月第一个星期日到 3 月第二个星期日
 * - PDT (Pacific Daylight Time): 夏令时，UTC-7，通常在 3 月第二个星期日到 11 月第一个星期日
 * 
 * 自动切换：
 * - PostgreSQL 和 JavaScript 的时区库会根据日期自动应用正确的时区偏移
 * - 无需手动处理夏令时/冬令时切换，系统会自动处理
 * 
 * 示例：
 * - 2025-03-09 02:00 PST → 2025-03-09 03:00 PDT（夏令时开始）
 * - 2025-11-02 02:00 PDT → 2025-11-02 01:00 PST（冬令时开始）
 */
export const SYSTEM_TIMEZONE = 'America/Los_Angeles'

/**
 * 将日期字符串格式化为 YYYY-MM-DD 格式
 * 不进行时区转换，直接处理日期字符串
 * 
 * @param date - 日期对象或日期字符串（YYYY-MM-DD 或其他格式）
 * @returns YYYY-MM-DD 格式的字符串
 */
export function formatDateString(date: Date | string | null | undefined): string {
  if (!date) return ''
  
  // 如果是字符串，尝试解析
  if (typeof date === 'string') {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date
    }
    // 尝试解析其他格式，使用 UTC 方法避免时区转换
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return date
  }
  
  // 如果是 Date 对象，使用 UTC 方法格式化（避免时区转换）
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return ''
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return ''
}

/**
 * 在日期字符串基础上添加指定天数
 * 不进行时区转换，直接计算日期
 * 
 * @param dateString - 日期字符串（YYYY-MM-DD）
 * @param days - 要添加的天数（可以是负数）
 * @returns 新的日期字符串（YYYY-MM-DD）
 */
export function addDaysToDateString(dateString: string, days: number): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Invalid date string format. Expected YYYY-MM-DD')
  }
  
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  
  return formatDateString(date)
}

/**
 * 比较两个日期字符串是否在同一天
 * 
 * @param date1 - 第一个日期字符串
 * @param date2 - 第二个日期字符串
 * @returns 是否在同一天
 */
export function isSameDateString(date1: string, date2: string): boolean {
  return formatDateString(date1) === formatDateString(date2)
}

/**
 * 比较两个日期字符串的大小
 * 
 * @param date1 - 第一个日期字符串
 * @param date2 - 第二个日期字符串
 * @returns date1 < date2 返回 -1, date1 > date2 返回 1, 相等返回 0
 */
export function compareDateStrings(date1: string, date2: string): number {
  const d1 = formatDateString(date1)
  const d2 = formatDateString(date2)
  
  if (d1 < d2) return -1
  if (d1 > d2) return 1
  return 0
}

/**
 * 获取日期字符串的星期几（0=周日, 1=周一, ..., 6=周六）
 * 
 * @param dateString - 日期字符串（YYYY-MM-DD）
 * @returns 星期几（0-6）
 */
export function getDayOfWeek(dateString: string): number {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Invalid date string format. Expected YYYY-MM-DD')
  }
  
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDay()
}

/**
 * 获取日期字符串的中文星期几
 * 
 * @param dateString - 日期字符串（YYYY-MM-DD）
 * @returns 中文星期几（如：星期一）
 */
export function getChineseDayOfWeek(dateString: string): string {
  const day = getDayOfWeek(dateString)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `星期${weekdays[day]}`
}

/**
 * 将日期字符串格式化为显示格式（月-日）
 * 
 * @param dateString - 日期字符串（YYYY-MM-DD）
 * @returns 显示格式（如：12-24）
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  
  const [, month, day] = dateString.split('-')
  return `${month}-${day}`
}

// ============================================
// 以下函数保留用于向后兼容，但已标记为废弃
// 新代码应该使用上面的函数，不获取当前时间
// ============================================

/**
 * @deprecated 不推荐使用，因为会读取外界时间
 * 如果确实需要获取"今天"，应该由用户输入或系统配置提供
 * 
 * 获取系统约定时区的当前日期字符串（YYYY-MM-DD）
 * ⚠️ 注意：这个函数会读取外界时间，不符合系统设计原则
 * 建议：使用用户输入或系统配置的日期，而不是自动获取
 */
export function getPSTTodayString(): string {
  const now = new Date()
  const pstDateStr = now.toLocaleString('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = pstDateStr.split('/')
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

/**
 * @deprecated 不推荐使用，因为会读取外界时间
 * 如果确实需要获取"今天"，应该由用户输入或系统配置提供
 */
export function getPSTToday(): Date {
  const dateStr = getPSTTodayString()
  const [year, month, day] = dateStr.split('-').map(Number)
  const pstDate = new Date(year, month - 1, day)
  pstDate.setHours(0, 0, 0, 0)
  return pstDate
}

/**
 * @deprecated 不推荐使用，因为会读取外界时间
 * 使用 addDaysToDateString() 代替
 */
export function getPSTDateWithOffset(days: number): Date {
  const today = getPSTToday()
  const result = new Date(today)
  result.setDate(today.getDate() + days)
  return result
}

/**
 * @deprecated 使用 formatDateString() 代替
 */
export function toPSTDateString(date: Date | string): string {
  return formatDateString(date)
}

/**
 * @deprecated 使用 isSameDateString() 代替
 */
export function isSamePSTDay(date1: Date | string, date2: Date | string): boolean {
  return isSameDateString(formatDateString(date1), formatDateString(date2))
}
