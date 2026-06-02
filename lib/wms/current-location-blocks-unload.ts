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

export type InboundInspectionAreaSyncPatch = {
  status?: string
  planned_unload_at?: Date | null
}

const INBOUND_UPDATE_META_KEYS = new Set(['updated_by', 'updated_at'])

/** 除 updated_by/updated_at 外是否还有入库字段待写入 */
export function inboundReceiptUpdateHasBusinessFields(
  data: Record<string, unknown>
): boolean {
  return Object.keys(data).some((k) => !INBOUND_UPDATE_META_KEYS.has(k))
}

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

/** 根据现在位置解析入库状态；无关键词则返回 null */
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

/**
 * 是否需联动入库管理：现在位置含查验/封闭区，或库内仍为查验/封闭区待退出。
 */
export function shouldSyncInboundFromPickupLocation(
  currentLocation: string | null | undefined,
  storedStatus: string | null | undefined
): boolean {
  if (currentLocationBlocksPlannedUnload(currentLocation)) return true
  if (inboundStatusBlocksUnload(storedStatus)) return true
  return false
}

/**
 * 提柜/入库同步时写入的 status（仅 shouldSync 为 true 时调用）：
 * - 现在位置含查验/封闭区 => 对应状态
 * - 库内原为查验/封闭区、现在位置已不含关键词 => 待处理
 */
export function resolveInboundStatusOnPickupSync(
  currentLocation: string | null | undefined,
  storedStatus: string | null | undefined
): string | undefined {
  const fromLocation = resolveInboundStatusFromCurrentLocation(currentLocation)
  if (fromLocation) return fromLocation
  if (inboundStatusBlocksUnload(storedStatus)) return 'pending'
  return undefined
}

/**
 * 仅查验/封闭区相关时生成入库更新补丁；无关时返回 null（不写库）。
 */
export function buildInboundInspectionAreaSyncPatch(args: {
  currentLocation: string | null | undefined
  storedStatus: string
  storedPlannedUnloadAt: Date | null | undefined
  pickupDate: Date | null | undefined
  etaDate: Date | null | undefined
  blockAutoPlannedUnloadAt: boolean
  recalculatePlannedUnloadAt: (
    pickupDate: Date | null | undefined,
    etaDate: Date | null | undefined
  ) => Date | null
}): InboundInspectionAreaSyncPatch | null {
  if (
    !shouldSyncInboundFromPickupLocation(args.currentLocation, args.storedStatus)
  ) {
    return null
  }

  const statusFromLocation = resolveInboundStatusOnPickupSync(
    args.currentLocation,
    args.storedStatus
  )
  if (statusFromLocation === undefined) {
    return null
  }

  const patch: InboundInspectionAreaSyncPatch = {}
  if (statusFromLocation !== args.storedStatus) {
    patch.status = statusFromLocation
  }

  if (!args.blockAutoPlannedUnloadAt) {
    const blocksUnload =
      statusFromLocation === INBOUND_STATUS_INSPECTION ||
      statusFromLocation === INBOUND_STATUS_CLOSED_AREA
    const next = blocksUnload
      ? null
      : args.recalculatePlannedUnloadAt(args.pickupDate, args.etaDate)
    const prevMs = args.storedPlannedUnloadAt?.getTime() ?? null
    const nextMs = next?.getTime() ?? null
    if (prevMs !== nextMs) {
      patch.planned_unload_at = next
    }
  }

  return Object.keys(patch).length > 0 ? patch : null
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
