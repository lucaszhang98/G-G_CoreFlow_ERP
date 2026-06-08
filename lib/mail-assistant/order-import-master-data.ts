import type { SourceForecastDetailRow } from '@/lib/mail-assistant/parse-source-forecast-excel'
import prisma from '@/lib/prisma'

export type OrderImportMasterData = {
  customers: Array<{ code: string; name: string }>
  locations: Array<{ location_code: string; name: string }>
  customerByCode: Map<string, string>
  locationByCode: Map<string, string>
}

export async function loadOrderImportMasterData(): Promise<OrderImportMasterData> {
  const [customers, locations] = await Promise.all([
    prisma.customers.findMany({
      select: { code: true, name: true },
    }),
    prisma.locations.findMany({
      select: { location_code: true, name: true },
    }),
  ])

  return {
    customers: customers
      .filter((c) => c.code)
      .map((c) => ({
        code: String(c.code),
        name: String(c.name ?? ''),
      })),
    locations: locations
      .filter((l) => l.location_code)
      .map((l) => ({
        location_code: String(l.location_code),
        name: String(l.name ?? ''),
      })),
    customerByCode: new Map(
      customers.filter((c) => c.code).map((c) => [String(c.code), String(c.name ?? '')])
    ),
    locationByCode: new Map(
      locations
        .filter((l) => l.location_code)
        .map((l) => [String(l.location_code), String(l.name ?? '')])
    ),
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export const PRIVATE_WAREHOUSE_NATURE = '私仓' as const

/** 需逐行输出、不汇总的明细所使用的编号位置序列 */
export type DedicatedLocationSeries = 'pickup' | 'private' | 'fedex'

const NUMBERED_LOCATION_PATTERNS: Record<DedicatedLocationSeries, RegExp> = {
  pickup: /^pickup\d+$/i,
  private: /^private\d+$/i,
  fedex: /^fedex\d+$/i,
}

function isCjkText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

export type CodeMatchResult = {
  code: string | null
  matchKind:
    | 'exact_code'
    | 'fuzzy_code'
    | 'exact_name'
    | 'fuzzy_name'
    | 'similar'
    | 'passthrough'
    | 'none'
}

/** 模糊优先匹配 code，配不上再匹配全名；返回系统 code */
export function matchMasterCode(
  raw: string,
  items: Array<{ code: string; name: string }>
): CodeMatchResult {
  const trimmed = raw.trim()
  const norm = normalizeKey(raw)
  if (!norm) return { code: null, matchKind: 'none' }

  for (const item of items) {
    if (normalizeKey(item.code) === norm) {
      return { code: item.code, matchKind: 'exact_code' }
    }
  }

  for (const item of items) {
    const codeNorm = normalizeKey(item.code)
    if (codeNorm.includes(norm) || norm.includes(codeNorm)) {
      return { code: item.code, matchKind: 'fuzzy_code' }
    }
  }

  for (const item of items) {
    if (normalizeKey(item.name) === norm) {
      return { code: item.code, matchKind: 'exact_name' }
    }
  }

  for (const item of items) {
    const nameNorm = normalizeKey(item.name)
    if (!nameNorm) continue
    if (nameNorm.includes(norm) || norm.includes(nameNorm)) {
      return { code: item.code, matchKind: 'fuzzy_name' }
    }
  }

  let best: { code: string; dist: number } | null = null
  for (const item of items) {
    for (const candidate of [normalizeKey(item.code), normalizeKey(item.name)]) {
      if (!candidate) continue
      // 避免「自提」等中文被编辑距离误配到 GG 等英文 code
      if (isCjkText(norm) !== isCjkText(candidate)) continue
      const dist = levenshtein(norm, candidate)
      if (!best || dist < best.dist) best = { code: item.code, dist }
    }
  }
  if (best && best.dist <= Math.max(3, Math.floor(norm.length * 0.35))) {
    return { code: best.code, matchKind: 'similar' }
  }

  return { code: null, matchKind: 'none' }
}

const CONTAINER_TYPES = ['40DH', '45DH', '40RH', '45RH', '20GP', '其他'] as const

export function matchContainerType(raw: string): (typeof CONTAINER_TYPES)[number] {
  const n = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!n) return '其他'
  if (/45.*RH|45.*冷|45RH/.test(n)) return '45RH'
  if (/40.*RH|40.*冷|40RH/.test(n)) return '40RH'
  if (/45.*DH|45.*高|45HC|45HQ|45DH/.test(n)) return '45DH'
  if (/40.*DH|40.*高|40HC|40HQ|40DH|40GP/.test(n)) return '40DH'
  if (/20/.test(n)) return '20GP'
  for (const t of CONTAINER_TYPES) {
    if (n.includes(t)) return t
  }
  return '其他'
}

const DELIVERY_NATURES = ['AMZ', '扣货', '已放行', '私仓', '转仓'] as const

const NATURE_SYNONYMS: Array<{ value: (typeof DELIVERY_NATURES)[number]; keys: string[] }> = [
  { value: 'AMZ', keys: ['amz', 'fba', '亚马逊', 'amazon', '派送方式fba', '亚马逊仓'] },
  { value: '扣货', keys: ['扣货', 'hold', 'detain', '暂扣', '海关扣'] },
  { value: '已放行', keys: ['已放行', '放行', 'release', 'released', '清关放行'] },
  { value: '私仓', keys: ['私仓', '私人仓', 'private', '非公仓', '第三方仓', '自提', 'fedex'] },
  { value: '转仓', keys: ['转仓', '转运', 'transfer', '调拨'] },
]

export function matchDeliveryNature(raw: string): (typeof DELIVERY_NATURES)[number] {
  const norm = normalizeKey(raw)
  if (!norm) return 'AMZ'
  for (const item of DELIVERY_NATURES) {
    if (normalizeKey(item) === norm) return item
  }
  for (const group of NATURE_SYNONYMS) {
    if (group.keys.some((k) => norm.includes(normalizeKey(k)) || normalizeKey(k).includes(norm))) {
      return group.value
    }
  }
  return 'AMZ'
}

function sortNumberedCodes(codes: string[], series: DedicatedLocationSeries): string[] {
  const prefix = series
  return codes.sort((a, b) => {
    const na = parseInt(a.replace(new RegExp(`^${prefix}`, 'i'), ''), 10)
    const nb = parseInt(b.replace(new RegExp(`^${prefix}`, 'i'), ''), 10)
    return na - nb
  })
}

/** 按 pickup1 / private1 / fedex1 … 数字序列出系统位置 code */
export function listNumberedLocationCodes(
  master: OrderImportMasterData,
  series: DedicatedLocationSeries
): string[] {
  const pattern = NUMBERED_LOCATION_PATTERNS[series]
  return sortNumberedCodes(
    master.locations.map((l) => l.location_code).filter((code) => pattern.test(code)),
    series
  )
}

export function buildNumberedLocationPools(master: OrderImportMasterData): Record<
  DedicatedLocationSeries,
  string[]
> {
  return {
    pickup: listNumberedLocationCodes(master, 'pickup'),
    private: listNumberedLocationCodes(master, 'private'),
    fedex: listNumberedLocationCodes(master, 'fedex'),
  }
}

function containsKeyword(norm: string, keywords: string[]): boolean {
  return keywords.some((k) => norm.includes(normalizeKey(k)) || normalizeKey(k).includes(norm))
}

/**
 * 根据源预报原文判断应使用哪组编号位置（pickup / private / fedex）
 */
export function classifyDedicatedLocationSeries(
  detail: SourceForecastDetailRow
): DedicatedLocationSeries {
  const loc = normalizeKey(detail.deliveryLocationRaw)
  const nature = normalizeKey(detail.deliveryNatureRaw)
  const mark = normalizeKey(detail.shippingMarkRaw)
  const fba = normalizeKey(detail.fba)
  const combined = `${loc} ${nature} ${mark} ${fba}`

  if (containsKeyword(loc, ['自提', 'ziti']) || containsKeyword(nature, ['自提', 'ziti'])) {
    return 'pickup'
  }
  if (containsKeyword(combined, ['fedex'])) {
    return 'fedex'
  }
  return 'private'
}

/** 是否应逐行输出（不与其他行汇总） */
export function isDedicatedDetail(detail: SourceForecastDetailRow): boolean {
  if (matchDeliveryNature(detail.deliveryNatureRaw) === PRIVATE_WAREHOUSE_NATURE) {
    return true
  }
  const loc = normalizeKey(detail.deliveryLocationRaw)
  const nature = normalizeKey(detail.deliveryNatureRaw)
  return (
    containsKeyword(loc, ['自提', '私仓', 'fedex', 'pickup', 'private']) ||
    containsKeyword(nature, ['自提', '私仓', 'fedex', 'pickup', 'private'])
  )
}

function isNumberedOrFedexHubCode(code: string): boolean {
  const norm = normalizeKey(code)
  return (
    NUMBERED_LOCATION_PATTERNS.pickup.test(code) ||
    NUMBERED_LOCATION_PATTERNS.private.test(code) ||
    NUMBERED_LOCATION_PATTERNS.fedex.test(code) ||
    norm === 'fedex'
  )
}

/**
 * 为逐行明细解析送仓地点：优先匹配源预报中已有的系统 code，否则从对应序列依次分配
 */
export function resolveDedicatedDetailLocationCode(
  detail: SourceForecastDetailRow,
  master: OrderImportMasterData,
  pools: Record<DedicatedLocationSeries, string[]>,
  counters: Record<DedicatedLocationSeries, number>
): { code: string | null; series: DedicatedLocationSeries } {
  const series = classifyDedicatedLocationSeries(detail)
  const locationItems = master.locations.map((l) => ({
    code: l.location_code,
    name: l.name,
  }))

  for (const raw of [detail.deliveryLocationRaw, detail.deliveryNatureRaw]) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const matched = matchMasterCode(trimmed, locationItems)
    if (matched.code && isNumberedOrFedexHubCode(matched.code)) {
      return { code: matched.code, series }
    }
  }

  const pool = pools[series]
  const idx = counters[series]
  counters[series] = idx + 1
  return { code: pool[idx] ?? null, series }
}

export function isPrivateWarehouseNature(nature: string): boolean {
  return nature === PRIVATE_WAREHOUSE_NATURE
}

export function parseOperationModeLabel(raw: string): '拆柜' | '直送' {
  const norm = normalizeKey(raw)
  const hasChaiGui = norm.includes('拆柜')
  const hasZhiSong =
    norm.includes('直送') || norm.includes('directdelivery') || norm === '直'
  // 「拆柜/直送」等复合说明按拆柜处理（多仓点预报通常为拆柜）
  if (hasZhiSong && !hasChaiGui) return '直送'
  return '拆柜'
}

export const OAK_MAIN_WAREHOUSE_CODE = 'GG'
