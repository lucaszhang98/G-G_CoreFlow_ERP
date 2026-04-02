/**
 * 送仓「近窗送货」筛选：UTC 日历下，从「昨天 0 点」到「后天 23:59:59.999」（含今天，共 4 个日历日）
 */

export function getDeliveryNearWindowUtcBounds(): { gte: Date; lte: Date } {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  end.setUTCDate(end.getUTCDate() + 2)
  end.setUTCHours(23, 59, 59, 999)
  return { gte: start, lte: end }
}
