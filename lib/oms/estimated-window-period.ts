/**
 * 预约明细「预计窗口期」：默认提柜日历日 +3；人工修改后不再随提柜日期自动更新。
 */

export function dateOnlyPart(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    const part = value.split('T')[0]?.trim()
    return part || null
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

/** 提柜日期（日历日）+ N 天，返回 UTC 日期的 Date（@db.Date 存库用） */
export function addCalendarDaysFromDateOnly(
  value: Date | string | null | undefined,
  days: number
): Date | null {
  const base = dateOnlyPart(value)
  if (!base) return null
  const [y, m, day] = base.split('-').map(Number)
  if (!y || !m || !day) return null
  return new Date(Date.UTC(y, m - 1, day + days))
}

export function pickupDateToEstimatedWindowPeriod(
  pickupDate: Date | string | null | undefined
): Date | null {
  return addCalendarDaysFromDateOnly(pickupDate, 3)
}

export function formatEstimatedWindowPeriodForApi(
  value: Date | string | null | undefined
): string | null {
  return dateOnlyPart(value)
}

/** 按本机日历日判断（与入库管理「显示当天」一致） */
function localCalendarDatePart(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 提柜日期是否为今天（本机日历日） */
export function isPickupDateToday(pickupDate: Date | string | null | undefined): boolean {
  const pickupPart = localCalendarDatePart(pickupDate)
  if (!pickupPart) return false
  return pickupPart === localCalendarDatePart(new Date())
}

/** PUT/表单：undefined=未传；null/''=清空 */
export function parseEstimatedWindowPeriodInput(
  value: unknown
): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const part = value.toISOString().split('T')[0]
    return addCalendarDaysFromDateOnly(part, 0)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = addCalendarDaysFromDateOnly(trimmed, 0)
    if (!parsed) throw new Error('预计窗口期格式无效，请使用 YYYY-MM-DD')
    return parsed
  }
  throw new Error('预计窗口期格式无效')
}
