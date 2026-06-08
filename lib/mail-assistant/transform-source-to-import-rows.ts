import { dateToExcelSerial, parseFlexibleDate } from '@/lib/mail-assistant/excel-date-serial'
import {
  buildNumberedLocationPools,
  classifyDedicatedLocationSeries,
  isDedicatedDetail,
  matchContainerType,
  matchDeliveryNature,
  matchMasterCode,
  OAK_MAIN_WAREHOUSE_CODE,
  parseOperationModeLabel,
  PRIVATE_WAREHOUSE_NATURE,
  resolveDedicatedDetailLocationCode,
  type DedicatedLocationSeries,
  type OrderImportMasterData,
} from '@/lib/mail-assistant/order-import-master-data'
import type { ParsedSourceForecast, SourceForecastDetailRow } from '@/lib/mail-assistant/parse-source-forecast-excel'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export type OrderImportDraftOutputRow = {
  order_number: string
  customer_code: string
  order_date_serial: number
  operation_mode: '拆柜' | '直送'
  delivery_location_code: string
  container_type: string
  eta_serial: number
  mbl_number: string
  do_issued: '是' | '否'
  detail_delivery_location_code: string
  delivery_nature: string
  quantity: number
  volume: number
  fba: string
  po: string
  detail_notes: string
  window_period: string
}

type AggregatedBucket = {
  deliveryLocationCode: string
  deliveryNature: string
  quantity: number
  weight: number
  volume: number
  fbaMap: Map<string, number>
  poList: string[]
  windowPeriod: string | null
}

type OrderHeaderFields = {
  order_number: string
  customer_code: string
  order_date_serial: number
  operation_mode: '拆柜' | '直送'
  delivery_location_code: string
  container_type: string
  eta_serial: number
  mbl_number: string
  do_issued: '是' | '否'
}

function todaySerial(): number {
  return dateToExcelSerial(new Date())
}

function resolveDateSerial(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.floor(raw)
  }
  const asStr = String(raw ?? '').trim()
  const asNum = parseFloat(asStr)
  if (Number.isFinite(asNum) && asNum > 30_000 && asNum < 100_000) {
    return Math.floor(asNum)
  }
  const d = parseFlexibleDate(raw)
  return d ? dateToExcelSerial(d) : fallback
}

function buildOrderHeaderFields(
  parsed: ParsedSourceForecast,
  containerNumber: string,
  master: OrderImportMasterData,
  warnings: string[]
): OrderHeaderFields | null {
  const cn = normalizeContainerNumber(containerNumber)
  const order = parsed.order

  const customerMatch = matchMasterCode(order.customerRaw, master.customers)
  if (!customerMatch.code) {
    warnings.push(`未能匹配客户「${order.customerRaw || '(空)'}」，已用首个客户代码兜底`)
  }
  const customerCode = customerMatch.code ?? master.customers[0]?.code ?? ''

  const operationMode = parseOperationModeLabel(order.operationModeRaw)
  const containerType = matchContainerType(order.containerTypeRaw)
  const mbl = order.mbl.trim() || '待补MBL'
  if (!order.mbl.trim()) warnings.push('源预报缺少 MBL，已填占位值，导入前请核对')

  const orderDateSerial = resolveDateSerial(order.orderDateRaw, todaySerial())
  const etaSerial = resolveDateSerial(order.etaRaw, orderDateSerial)

  const firstRawDetail = parsed.details.find((d) => d.deliveryLocationRaw.trim())
  const firstDetailMatch = firstRawDetail
    ? matchMasterCode(
        firstRawDetail.deliveryLocationRaw,
        master.locations.map((l) => ({ code: l.location_code, name: l.name }))
      )
    : { code: null }

  let destinationCode = firstDetailMatch.code ?? OAK_MAIN_WAREHOUSE_CODE
  if (operationMode === '拆柜') {
    destinationCode = OAK_MAIN_WAREHOUSE_CODE
    if (!master.locationByCode.has(OAK_MAIN_WAREHOUSE_CODE)) {
      warnings.push('系统中无 GG 位置代码，导入前请确认目的地')
    }
  }

  return {
    order_number: cn,
    customer_code: customerCode,
    order_date_serial: orderDateSerial,
    operation_mode: operationMode,
    delivery_location_code: destinationCode,
    container_type: containerType,
    eta_serial: etaSerial,
    mbl_number: mbl,
    do_issued: '是',
  }
}

function bucketKey(deliveryLocationCode: string, deliveryNature: string): string {
  return `${deliveryLocationCode}|${deliveryNature}`
}

function aggregateStandardDetails(
  details: SourceForecastDetailRow[],
  master: OrderImportMasterData,
  warnings: string[]
): Map<string, AggregatedBucket> {
  const buckets = new Map<string, AggregatedBucket>()

  for (const detail of details) {
    const locMatch = matchMasterCode(
      detail.deliveryLocationRaw,
      master.locations.map((l) => ({ code: l.location_code, name: l.name }))
    )
    if (!locMatch.code) {
      warnings.push(`送仓地点「${detail.deliveryLocationRaw}」未能匹配系统位置代码，已跳过`)
      continue
    }
    const nature = matchDeliveryNature(detail.deliveryNatureRaw)
    const key = bucketKey(locMatch.code, nature)

    if (!buckets.has(key)) {
      buckets.set(key, {
        deliveryLocationCode: locMatch.code,
        deliveryNature: nature,
        quantity: 0,
        weight: 0,
        volume: 0,
        fbaMap: new Map(),
        poList: [],
        windowPeriod: detail.windowPeriod || null,
      })
    }

    const bucket = buckets.get(key)!
    bucket.quantity += detail.quantity
    bucket.weight += detail.weight
    bucket.volume += detail.volume

    if ((!bucket.windowPeriod || !bucket.windowPeriod.trim()) && detail.windowPeriod.trim()) {
      bucket.windowPeriod = detail.windowPeriod
    }

    if (detail.fba) {
      const prev = bucket.fbaMap.get(detail.fba) ?? 0
      bucket.fbaMap.set(detail.fba, prev + (detail.quantity || 1))
    }
    if (detail.po && !bucket.poList.includes(detail.po)) {
      bucket.poList.push(detail.po)
    }
  }

  return buckets
}

function buildDedicatedDetailRows(
  details: SourceForecastDetailRow[],
  header: OrderHeaderFields,
  master: OrderImportMasterData,
  warnings: string[]
): OrderImportDraftOutputRow[] {
  const pools = buildNumberedLocationPools(master)
  const counters: Record<DedicatedLocationSeries, number> = {
    pickup: 0,
    private: 0,
    fedex: 0,
  }
  const rows: OrderImportDraftOutputRow[] = []

  for (const detail of details) {
    const { code, series } = resolveDedicatedDetailLocationCode(
      detail,
      master,
      pools,
      counters
    )
    if (!code) {
      warnings.push(
        `${series} 序列位置已用尽（可用 ${pools[series].length} 个），已跳过唛头 ${detail.shippingMarkRaw || detail.fba || '(空)'}`
      )
      continue
    }

    const mark = detail.shippingMarkRaw.trim()
    const qty = Math.max(1, Math.round(detail.quantity))
    const vol = Math.max(0.01, Math.round(detail.volume * 100) / 100)
    const fbaKey = mark || detail.fba.trim()

    rows.push({
      ...header,
      detail_delivery_location_code: code,
      delivery_nature: PRIVATE_WAREHOUSE_NATURE,
      quantity: qty,
      volume: vol,
      fba: fbaKey ? `${fbaKey}##${qty}` : '',
      po: detail.po.trim(),
      detail_notes: mark,
      window_period: detail.windowPeriod.trim(),
    })
  }

  return rows
}

function buildAggregatedRows(
  buckets: Map<string, AggregatedBucket>,
  header: OrderHeaderFields
): OrderImportDraftOutputRow[] {
  const rows: OrderImportDraftOutputRow[] = []

  for (const bucket of buckets.values()) {
    const qty = Math.max(1, Math.round(bucket.quantity))
    const vol = Math.max(0.01, Math.round(bucket.volume * 100) / 100)
    const fbaValue = Array.from(bucket.fbaMap.entries())
      .map(([fba, q]) => `${fba}##${q}`)
      .join('\n')

    rows.push({
      ...header,
      detail_delivery_location_code: bucket.deliveryLocationCode,
      delivery_nature: bucket.deliveryNature,
      quantity: qty,
      volume: vol,
      fba: fbaValue,
      po: bucket.poList.join('\n'),
      detail_notes: '',
      window_period: bucket.windowPeriod ?? '',
    })
  }

  return rows
}

/**
 * AMZ 等按 (送仓地点, 性质) 汇总；
 * 自提→pickupN、私仓→privateN、FedEx→fedexN，逐行输出且明细备注写唛头
 */
export function transformSourceToImportRows(
  parsed: ParsedSourceForecast,
  containerNumber: string,
  master: OrderImportMasterData
): { rows: OrderImportDraftOutputRow[]; warnings: string[] } {
  const warnings: string[] = []
  const header = buildOrderHeaderFields(parsed, containerNumber, master, warnings)
  if (!header) {
    return { rows: [], warnings: ['无法解析订单头'] }
  }

  const dedicatedDetails: SourceForecastDetailRow[] = []
  const standardDetails: SourceForecastDetailRow[] = []

  for (const detail of parsed.details) {
    if (isDedicatedDetail(detail)) {
      dedicatedDetails.push(detail)
    } else {
      standardDetails.push(detail)
    }
  }

  const buckets = aggregateStandardDetails(standardDetails, master, warnings)
  const amzRows = buildAggregatedRows(buckets, header)
  const dedicatedRows = buildDedicatedDetailRows(dedicatedDetails, header, master, warnings)

  const rows = [...amzRows, ...dedicatedRows]

  if (rows.length === 0) {
    warnings.push('未解析到可汇总的明细行')
  } else if (dedicatedRows.length > 0) {
    const seriesCount = dedicatedDetails.reduce(
      (acc, d) => {
        const s = classifyDedicatedLocationSeries(d)
        acc[s] = (acc[s] ?? 0) + 1
        return acc
      },
      {} as Partial<Record<DedicatedLocationSeries, number>>
    )
    const parts = (['pickup', 'private', 'fedex'] as const)
      .filter((s) => (seriesCount[s] ?? 0) > 0)
      .map((s) => `${s}${seriesCount[s]}`)
    warnings.push(`逐行明细 ${dedicatedRows.length} 行（${parts.join('、')}）`)
  }

  return { rows, warnings }
}
