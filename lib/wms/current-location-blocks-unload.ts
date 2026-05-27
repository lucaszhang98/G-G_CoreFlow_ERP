/**
 * 提柜「现在位置」含以下关键词时，与查验同等处理：
 * - 入库拆柜日期置空
 * - 入库状态改为 inspection（在入库 API 改现在位置时）
 * - 提柜/入库列表红色高亮
 */
export const CURRENT_LOCATION_BLOCKS_UNLOAD_KEYWORDS = ['查验', '封闭区'] as const

export function includesInspectionKeyword(
  currentLocation: string | null | undefined
): boolean {
  if (typeof currentLocation !== 'string' || !currentLocation.trim()) {
    return false
  }
  return CURRENT_LOCATION_BLOCKS_UNLOAD_KEYWORDS.some((kw) =>
    currentLocation.includes(kw)
  )
}

/** Prisma where：现在位置含查验或封闭区 */
export function pickupCurrentLocationBlocksUnloadWhere() {
  return {
    OR: CURRENT_LOCATION_BLOCKS_UNLOAD_KEYWORDS.map((kw) => ({
      current_location: { contains: kw },
    })),
  }
}
