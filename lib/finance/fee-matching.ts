/**
 * 费用与订单柜型匹配：订单侧使用 40DH/45DH，费用主数据可与 HQ 等价归一化后比较。
 * 选费规则：同一 fee_code 优先该客户专属（customer_id 或 fee_scope），否则用归属「所有客户」的默认行。
 */

export function normalizeContainerTypeForMatch(
  s: string | null | undefined
): string {
  if (s == null || String(s).trim() === '') return ''
  return String(s).trim().toUpperCase().replace(/HQ/g, 'DH')
}

export function feeMatchesContainer(
  feeContainer: string | null | undefined,
  orderContainer: string | null | undefined
): boolean {
  const fc = feeContainer?.trim()
  if (!fc) return true
  const oc = orderContainer?.trim()
  if (!oc) return true
  return (
    normalizeContainerTypeForMatch(feeContainer) ===
    normalizeContainerTypeForMatch(orderContainer)
  )
}

export type FeeForMatch = {
  id: bigint
  fee_code: string
  fee_name: string
  unit: string | null
  unit_price: unknown
  currency: string | null
  scope_type: string
  container_type: string | null
  customer_id: bigint | null
  sort_order?: number | null
  fee_scope?: { customer_id: bigint }[]
}

export function feeAppliesToSpecificCustomer(
  f: FeeForMatch,
  customerId: bigint
): boolean {
  if (f.customer_id != null && f.customer_id === customerId) return true
  if (f.fee_scope?.some((s) => s.customer_id === customerId)) return true
  return false
}

export function isDefaultAllCustomersFee(f: FeeForMatch): boolean {
  return f.scope_type === 'all'
}

/** 同 fee_code 下「所有客户」默认行中选一条作柜型未命中时的回退（优先不限柜型，再 sort_order / id） */
function pickFallbackDefaultAllCustomerForFeeCode(
  fees: FeeForMatch[],
  feeCode: string
): FeeForMatch | null {
  const c = feeCode.trim()
  const pool = fees.filter(
    (f) => f.fee_code.trim() === c && isDefaultAllCustomersFee(f)
  )
  if (pool.length === 0) return null
  pool.sort((a, b) => {
    const aAny = !a.container_type?.trim()
    const bAny = !b.container_type?.trim()
    if (aAny !== bAny) return aAny ? -1 : 1
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (so !== 0) return so
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return pool[0] ?? null
}

function scoreForPick(
  f: FeeForMatch,
  customerId: bigint,
  orderContainer: string | null | undefined
): number {
  let s = 0
  if (f.customer_id != null) s += 10
  if (f.fee_scope?.some((x) => x.customer_id === customerId)) s += 8
  if (f.container_type?.trim() && feeMatchesContainer(f.container_type, orderContainer))
    s += 5
  return s
}

/**
 * 账单明细「新建明细」候选：
 * - 先按柜型过滤；
 * - 再按 fee_code 分组：若该编码下存在**适用于当前客户**的行，则只保留这些行，**不展示**同组「所有客户」默认行；
 *   若该编码下没有任何客户专属行，则只保留「所有客户」默认行。
 * - 同一编码可保留多条客户专属行（如不同仓点），不按分数压成一条。
 * - 若某 fee_code 在柜型过滤后没有任何行，再追加一条归属「所有客户」的默认费用（不限柜型），便于 20GP 等柜型仅有他柜型价目时仍能选手动加价。
 */
export function listFeesForInvoiceLinePicker(
  fees: FeeForMatch[],
  customerId: bigint,
  orderContainer: string | null | undefined
): FeeForMatch[] {
  const M = fees.filter((f) =>
    feeMatchesContainer(f.container_type, orderContainer)
  )

  const byCode = new Map<string, FeeForMatch[]>()
  for (const f of M) {
    const code = f.fee_code.trim()
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(f)
  }

  const out: FeeForMatch[] = []
  for (const group of byCode.values()) {
    const specifics = group.filter((f) =>
      feeAppliesToSpecificCustomer(f, customerId)
    )
    if (specifics.length > 0) {
      out.push(...specifics)
    } else {
      const defaults = group.filter((f) => isDefaultAllCustomersFee(f))
      if (defaults.length > 0) {
        out.push(...defaults)
      } else {
        out.push(...group)
      }
    }
  }

  const codesWithPick = new Set(out.map((f) => f.fee_code.trim()))
  const allCodes = new Set(fees.map((f) => f.fee_code.trim()))
  for (const code of allCodes) {
    if (codesWithPick.has(code)) continue
    const fb = pickFallbackDefaultAllCustomerForFeeCode(fees, code)
    if (fb) {
      out.push(fb)
      codesWithPick.add(code)
    }
  }

  out.sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (so !== 0) return so
    const c = a.fee_code.localeCompare(b.fee_code)
    if (c !== 0) return c
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return out
}

/**
 * 按 fee_code 去重：有客户专属则用专属，否则用「所有客户」默认行；以柜型匹配为主，
 * 某编码在柜型过滤后无候选时，为该编码补一条「所有客户」默认行（不限柜型：优先 container 为空，再 sort_order / id）。
 */
export function resolveFeesForInvoiceLinePick(
  fees: FeeForMatch[],
  customerId: bigint,
  orderContainer: string | null | undefined
): FeeForMatch[] {
  const M = fees.filter((f) =>
    feeMatchesContainer(f.container_type, orderContainer)
  )

  const byCode = new Map<string, FeeForMatch[]>()
  for (const f of M) {
    const code = f.fee_code.trim()
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(f)
  }

  const feeCodes = new Set(fees.map((f) => f.fee_code.trim()))
  for (const code of feeCodes) {
    if (byCode.has(code)) continue
    const fb = pickFallbackDefaultAllCustomerForFeeCode(fees, code)
    if (fb) byCode.set(code, [fb])
  }

  const out: FeeForMatch[] = []
  for (const group of byCode.values()) {
    const specific = group.filter((f) =>
      feeAppliesToSpecificCustomer(f, customerId)
    )
    const pool = specific.length > 0 ? specific : group.filter((f) => isDefaultAllCustomersFee(f))
    if (pool.length === 0) continue
    pool.sort(
      (a, b) =>
        scoreForPick(b, customerId, orderContainer) -
        scoreForPick(a, customerId, orderContainer)
    )
    out.push(pool[0]!)
  }

  out.sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (so !== 0) return so
    return a.fee_code.localeCompare(b.fee_code)
  })
  return out
}

export function isFeeIdAllowedForInvoiceContext(
  fee: FeeForMatch,
  resolved: FeeForMatch[]
): boolean {
  return resolved.some((r) => r.id === fee.id)
}
