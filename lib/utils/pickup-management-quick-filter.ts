/**
 * 提柜管理「待查询」「待提柜」快速筛选的 ETA 窗口（与原有 LFD/提柜条件 AND）
 *
 * 范围：以 UTC 日历「今天」为锚点，ETA 在 [今天-28天, 今天+2天]（含端点），与产品示例一致：
 * 若今天为 2026-04-01，则 ETA 在 2026-03-04 ～ 2026-04-03。
 */

export function getPickupQuickFilterEtaDateRange(): { gte: Date; lte: Date } {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  start.setUTCDate(start.getUTCDate() - 28)
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  end.setUTCDate(end.getUTCDate() + 2)
  return { gte: start, lte: end }
}
