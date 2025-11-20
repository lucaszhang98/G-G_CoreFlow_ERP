/**
 * 日期格式化工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date - 日期对象、字符串或 null
 * @returns 格式化后的日期字符串，无效日期返回 "-"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return "-"
    }
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    
    if (isNaN(year) || isNaN(Number(month)) || isNaN(Number(day))) {
      return "-"
    }
    
    return `${year}-${month}-${day}`
  } catch {
    return "-"
  }
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param date - 日期对象、字符串或 null
 * @returns 格式化后的日期时间字符串，无效日期返回 "-"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-"
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return "-"
    }
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch {
    return "-"
  }
}

