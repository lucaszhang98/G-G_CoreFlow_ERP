/**
 * 提柜「现在位置」与入库 status 联动：
 * - 含「查验」=> status=inspection，拆柜日期置空，列表标红
 * - 含「封闭区」=> status=closed_area，拆柜日期置空，列表标红
 * （同时含两者时优先查验）
 */

export const INBOUND_STATUS_INSPECTION = 'inspection' as const
export const INBOUND_STATUS_CLOSED_AREA = 'closed_area' as const

export const CURRENT_LOCATION_INSPECTION_KEYWORD = '查验'
export const CURRENT_LOCATION_CLOSED_AREA_KEYWORD = '封闭区'

export const CURRENT_LOCATION_BLOCKS_UNLOAD_KEYWORDS = [
  CURRENT_LOCATION_INSPECTION_KEYWORD,
  CURRENT_LOCATION_CLOSED_AREA_KEYWORD,
] as const

export type InboundStatusFromCurrentLocation =
  | typeof INBOUND_STATUS_INSPECTION
  | typeof INBOUND_STATUS_CLOSED_AREA

export function includesInspectionKeyword(
  currentLocation: string | null | undefined
): boolean {
  return (
    typeof currentLocation === 'string' &&
    currentLocation.includes(CURRENT_LOCATION_INSPECTION_KEYWORD)
  )
}

export function includesClosedAreaKeyword(
  currentLocation: string | null | undefined
): boolean {
  return (
    typeof currentLocation === 'string' &&
    currentLocation.includes(CURRENT_LOCATION_CLOSED_AREA_KEYWORD)
  )
}

/** 现在位置是否需要清空拆柜日期（查验或封闭区） */
export function currentLocationBlocksPlannedUnload(
  currentLocation: string | null | undefined
): boolean {
  return (
    includesInspectionKeyword(currentLocation) ||
    includesClosedAreaKeyword(currentLocation)
  )
}

/** 根据现在位置解析入库状态；无关键词则返回 null（表示恢复待处理） */
export function resolveInboundStatusFromCurrentLocation(
  currentLocation: string | null | undefined
): InboundStatusFromCurrentLocation | null {
  if (includesInspectionKeyword(currentLocation)) {
    return INBOUND_STATUS_INSPECTION
  }
  if (includesClosedAreaKeyword(currentLocation)) {
    return INBOUND_STATUS_CLOSED_AREA
  }
  return null
}

export function inboundStatusBlocksUnload(
  status: string | null | undefined
): boolean {
  return (
    status === INBOUND_STATUS_INSPECTION ||
    status === INBOUND_STATUS_CLOSED_AREA
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

/** 入库列表行：状态为查验/封闭区，或现在位置含对应关键词 */
export function inboundRowShouldHighlightAsInspection(row: {
  status?: string | null
  current_location?: string | null
}): boolean {
  if (inboundStatusBlocksUnload(row.status)) return true
  return currentLocationBlocksPlannedUnload(row.current_location)
}

/**
 * 列表展示用状态：以提柜「现在位置」为准；非查验/封闭区时固定展示待处理（不沿用库内旧的 inspection/closed_area）。
 */
export function resolveInboundDisplayStatus(
  currentLocation: string | null | undefined,
  storedStatus: string | null | undefined
): string {
  const fromLocation = resolveInboundStatusFromCurrentLocation(currentLocation)
  if (fromLocation) return fromLocation
  if (inboundStatusBlocksUnload(storedStatus)) {
    return 'pending'
  }
  return storedStatus ?? 'pending'
}
