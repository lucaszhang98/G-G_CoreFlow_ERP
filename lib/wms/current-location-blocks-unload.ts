/**
 * 提柜「现在位置」与入库联动（须对比更新前/后的现在位置）：
 * 1. 新位置含「查验」/「封闭区」=> status 对应 + 清空拆柜日期
 * 2. 仅当库内原为查验/封闭区，且新位置不再含关键词 => status=待处理 + 按提柜/ETA 重算拆柜日期
 * 3. 正常柜（从未进入查验/封闭区）=> 只走拆柜日期老逻辑，不改 status
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

/** 列表展示用：已打印/已入库/已到仓在「待放出」场景仍展示库内真实值 */
export const INBOUND_WORKFLOW_STATUSES = [
  'printed',
  'received',
  'arrived',
] as const

export function isInboundWorkflowStatus(
  status: string | null | undefined
): boolean {
  return (
    status != null &&
    (INBOUND_WORKFLOW_STATUSES as readonly string[]).includes(status)
  )
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

/** 现在位置是否含查验/封闭区关键词 */
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

/** 进入查验/封闭区：仅看更新后的现在位置 */
export function isEnteringInspectionArea(
  newLocation: string | null | undefined
): boolean {
  return currentLocationBlocksPlannedUnload(newLocation)
}

/**
 * 放出查验/封闭区：更新前现在位置含关键词、更新后不含，且库内 status 为 inspection/closed_area。
 * 不因 Excel 空位置、普通备注或「库内误标查验但从未在提柜位置出现关键词」而触发。
 */
export function isExitingInspectionArea(
  previousLocation: string | null | undefined,
  newLocation: string | null | undefined,
  storedStatus: string | null | undefined
): boolean {
  if (currentLocationBlocksPlannedUnload(newLocation)) return false
  if (!currentLocationBlocksPlannedUnload(previousLocation)) return false
  if (!inboundStatusBlocksUnload(storedStatus)) return false
  return true
}

/** @deprecated 使用 isEnteringInspectionArea / isExitingInspectionArea */
export function shouldSyncInboundFromPickupLocation(
  previousLocation: string | null | undefined,
  newLocation: string | null | undefined,
  storedStatus: string | null | undefined
): boolean {
  return (
    isEnteringInspectionArea(newLocation) ||
    isExitingInspectionArea(previousLocation, newLocation, storedStatus)
  )
}

/**
 * 查验/封闭区进出：生成 status / 拆柜日期补丁。
 */
export function buildInboundInspectionAreaSyncPatch(args: {
  previousLocation?: string | null | undefined
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
  const next = args.currentLocation
  const patch: InboundInspectionAreaSyncPatch = {}

  if (isEnteringInspectionArea(next)) {
    const statusFromLocation = resolveInboundStatusFromCurrentLocation(next)
    if (statusFromLocation && statusFromLocation !== args.storedStatus) {
      patch.status = statusFromLocation
    }
    if (!args.blockAutoPlannedUnloadAt) {
      const prevMs = args.storedPlannedUnloadAt?.getTime() ?? null
      if (prevMs !== null) {
        patch.planned_unload_at = null
      }
    }
    return Object.keys(patch).length > 0 ? patch : null
  }

  if (isExitingInspectionArea(args.previousLocation, next, args.storedStatus)) {
    if (args.storedStatus !== 'pending') {
      patch.status = 'pending'
    }
    if (!args.blockAutoPlannedUnloadAt) {
      const nextPlanned = args.recalculatePlannedUnloadAt(
        args.pickupDate,
        args.etaDate
      )
      const prevMs = args.storedPlannedUnloadAt?.getTime() ?? null
      const nextMs = nextPlanned?.getTime() ?? null
      if (prevMs !== nextMs) {
        patch.planned_unload_at = nextPlanned
      }
    }
    return Object.keys(patch).length > 0 ? patch : null
  }

  return null
}

/**
 * 正常柜：仅按提柜/ETA 重算拆柜日期（老逻辑），不改 status。
 */
export function buildNormalPlannedUnloadSyncPatch(args: {
  storedPlannedUnloadAt: Date | null | undefined
  pickupDate: Date | null | undefined
  etaDate: Date | null | undefined
  blockAutoPlannedUnloadAt: boolean
  recalculatePlannedUnloadAt: (
    pickupDate: Date | null | undefined,
    etaDate: Date | null | undefined
  ) => Date | null
}): InboundInspectionAreaSyncPatch | null {
  if (args.blockAutoPlannedUnloadAt) return null
  const next = args.recalculatePlannedUnloadAt(args.pickupDate, args.etaDate)
  const prevMs = args.storedPlannedUnloadAt?.getTime() ?? null
  const nextMs = next?.getTime() ?? null
  if (prevMs === nextMs) return null
  return { planned_unload_at: next }
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
 * 列表展示：新位置含关键词优先；库内查验/封闭区且新位置无关键词时展示待处理（待放出）；
 * 已打印/已入库/已到仓展示库内真实值。
 */
export function resolveInboundDisplayStatus(
  currentLocation: string | null | undefined,
  storedStatus: string | null | undefined
): string {
  const fromLocation = resolveInboundStatusFromCurrentLocation(currentLocation)
  if (fromLocation) return fromLocation
  if (
    inboundStatusBlocksUnload(storedStatus) &&
    !isInboundWorkflowStatus(storedStatus) &&
    !currentLocationBlocksPlannedUnload(currentLocation)
  ) {
    return 'pending'
  }
  return storedStatus ?? 'pending'
}
