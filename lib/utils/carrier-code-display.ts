/** 提柜管理承运公司：仅 CVT / NST / GG，展示用底色区分 */

export const PICKUP_CARRIER_CODES = ['CVT', 'NST', 'GG'] as const
export type PickupCarrierCode = (typeof PICKUP_CARRIER_CODES)[number]

/** 铺满 td 内边距的承运公司单元格容器（与 data-table 默认 px-1.5 py-0.5 对齐） */
export const CARRIER_CODE_CELL_SURFACE_LAYOUT =
  'absolute -inset-x-1.5 -inset-y-0.5 flex items-center justify-center'

/** 将用户输入规范为 CVT / NST / GG；无法识别则返回 null */
export function normalizeCarrierCodeInput(
  input: string | null | undefined
): PickupCarrierCode | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  if (upper === 'CVT') return 'CVT'
  if (upper === 'NST') return 'NST'
  if (upper === 'GG' || upper === 'G&G' || upper === 'G & G') return 'GG'
  return null
}

export function formatCarrierCodeDisplay(
  input: string | null | undefined
): string | null {
  return normalizeCarrierCodeInput(input) ?? (input?.trim() ? input.trim().toUpperCase() : null)
}

/** 承运公司单元格底色（仅该字段使用） */
export function getCarrierCodeCellClass(code: string | null | undefined): string {
  const normalized = normalizeCarrierCodeInput(code)
  if (normalized === 'CVT') {
    return 'bg-blue-200/90 dark:bg-blue-900/45'
  }
  if (normalized === 'GG') {
    return 'bg-gray-200 dark:bg-gray-600/45'
  }
  if (normalized === 'NST') {
    return 'bg-green-200/90 dark:bg-green-900/45'
  }
  return ''
}

export function getCarrierCodeCellSurfaceClass(code: string | null | undefined): string {
  const bg = getCarrierCodeCellClass(code)
  return bg ? `${CARRIER_CODE_CELL_SURFACE_LAYOUT} ${bg}` : CARRIER_CODE_CELL_SURFACE_LAYOUT
}

export function carrierCodeFromRelation(
  carrier: { carrier_code?: string | null; name?: string | null } | null | undefined
): PickupCarrierCode | null {
  if (!carrier) return null
  const fromCode = normalizeCarrierCodeInput(carrier.carrier_code)
  if (fromCode) return fromCode
  return normalizeCarrierCodeInput(carrier.name)
}
