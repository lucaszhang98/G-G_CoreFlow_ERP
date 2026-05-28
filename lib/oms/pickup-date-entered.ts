/**
 * 提柜日期「录入日」：空 → 有值时记录时间；仅录入当天预约明细「预计窗口期」标红。
 */

/** 业务日历时区（与运营口径一致） */
export const PICKUP_DATE_HIGHLIGHT_TIMEZONE = 'America/Los_Angeles'

export function hasPickupDateValue(value: Date | string | null | undefined): boolean {
  if (value == null || value === '') return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return true
}

export function calendarDayInTimezone(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone })
}

/** 提柜日期是否在今天被录入（空→有值的那天，洛杉矶日历日） */
export function isPickupDateEnteredHighlightToday(
  enteredAt: Date | string | null | undefined,
  timeZone: string = PICKUP_DATE_HIGHLIGHT_TIMEZONE
): boolean {
  if (!enteredAt) return false
  const entered = typeof enteredAt === 'string' ? new Date(enteredAt) : enteredAt
  if (!(entered instanceof Date) || Number.isNaN(entered.getTime())) return false
  return (
    calendarDayInTimezone(entered, timeZone) === calendarDayInTimezone(new Date(), timeZone)
  )
}

/**
 * 订单 pickup_date 变更时，是否更新 pickup_date_entered_at。
 * - 空 → 有值：记 now
 * - 有值 → 空：清空
 * - 有值 → 有值（改日期）：不改 entered_at
 */
export function resolvePickupDateEnteredAt(
  previousPickup: Date | null | undefined,
  nextPickup: Date | null | undefined,
  _existingEnteredAt: Date | null | undefined,
  now: Date = new Date()
): Date | null | undefined {
  const had = hasPickupDateValue(previousPickup)
  const has = hasPickupDateValue(nextPickup)
  if (!had && has) return now
  if (had && !has) return null
  return undefined
}

export function applyPickupDateEnteredAtToOrderUpdate(
  orderUpdate: Record<string, unknown>,
  ctx: {
    previousPickup: Date | null | undefined
    existingEnteredAt: Date | null | undefined
    now?: Date
  }
): void {
  if (orderUpdate.pickup_date === undefined) return
  const nextPickup = orderUpdate.pickup_date as Date | null | undefined
  const enteredAt = resolvePickupDateEnteredAt(
    ctx.previousPickup,
    nextPickup,
    ctx.existingEnteredAt,
    ctx.now
  )
  if (enteredAt !== undefined) {
    orderUpdate.pickup_date_entered_at = enteredAt
  }
}
