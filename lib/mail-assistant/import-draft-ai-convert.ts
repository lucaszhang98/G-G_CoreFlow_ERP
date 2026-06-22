import { buildExcelPreviewForAi } from '@/lib/mail-assistant/forecast-excel-scorer'
import { isForecastAiEnabled } from '@/lib/mail-assistant/forecast-ai-config'
import { loadImportDraftCorrectionExamples } from '@/lib/mail-assistant/forecast-feedback-store'
import { geminiGenerateContent } from '@/lib/mail-assistant/gemini-client'
import { dateToExcelSerial, parseFlexibleDate } from '@/lib/mail-assistant/excel-date-serial'
import {
  buildNumberedLocationPools,
  classifyDedicatedLocationSeries,
  isPrivateWarehouseNature,
  listNumberedLocationCodes,
  matchContainerType,
  matchDeliveryNature,
  matchMasterCode,
  OAK_MAIN_WAREHOUSE_CODE,
  parseOperationModeLabel,
  PRIVATE_WAREHOUSE_NATURE,
  type DedicatedLocationSeries,
  type OrderImportMasterData,
} from '@/lib/mail-assistant/order-import-master-data'
import {
  isSourceForecastTemplateInputFormat,
  type ParsedSourceForecast,
} from '@/lib/mail-assistant/parse-source-forecast-excel'
import {
  transformSourceToImportRows,
  type OrderImportDraftOutputRow,
} from '@/lib/mail-assistant/transform-source-to-import-rows'

const NUMBERED_LOCATION_RE = /^(pickup|private|fedex)\d+$/i

type TransformOptions = {
  emailSubject?: string | null
  fixedOrderDateKey?: string | null
  fixedCustomerCode?: string | null
}

type MailAssistantRowFields = {
  fixedOrderDateKey?: string | null
  fixedCustomerCode?: string | null
}

/** 模版转换完成后，用邮件助手明细行的客户代码、订单日期覆盖导入表（其余字段保持模版结果） */
export function applyMailAssistantOrderFields(
  rows: OrderImportDraftOutputRow[],
  master: OrderImportMasterData,
  fields: MailAssistantRowFields,
  warnings: string[]
): OrderImportDraftOutputRow[] {
  if (rows.length === 0) return rows

  const customerCode = fields.fixedCustomerCode?.trim()
  const orderDateKey = fields.fixedOrderDateKey?.trim()

  let patchedCustomer: string | undefined
  if (customerCode) {
    if (master.customerByCode.has(customerCode)) {
      patchedCustomer = customerCode
      warnings.push(`客户代码已对齐邮件助手明细行：${customerCode}`)
    } else {
      warnings.push(`邮件助手客户「${customerCode}」不在系统主数据，保留模版转换结果`)
    }
  }

  let patchedOrderDateSerial: number | undefined
  if (orderDateKey) {
    const d = parseFlexibleDate(orderDateKey)
    if (d) {
      patchedOrderDateSerial = dateToExcelSerial(d)
      warnings.push(`订单日期已对齐邮件助手明细行：${orderDateKey}`)
    } else {
      warnings.push(`邮件助手订单日期「${orderDateKey}」无效，保留模版转换结果`)
    }
  }

  if (!patchedCustomer && !patchedOrderDateSerial) return rows

  return rows.map((row) => ({
    ...row,
    ...(patchedCustomer ? { customer_code: patchedCustomer } : {}),
    ...(patchedOrderDateSerial != null ? { order_date_serial: patchedOrderDateSerial } : {}),
  }))
}

export type ImportDraftTransformResult = {
  rows: OrderImportDraftOutputRow[]
  warnings: string[]
  usedAi: boolean
  aiReason?: string
}

type AiImportDraftResponse = {
  usable?: boolean
  reason?: string
  orderHeader?: {
    customer_code?: string
    order_date?: string
    operation_mode?: string
    destination_code?: string
    container_type?: string
    eta?: string
    mbl?: string
  }
  detailRows?: Array<{
    detail_delivery_location_code?: string
    delivery_nature?: string
    quantity?: number
    volume?: number
    fba?: string
    po?: string
    detail_notes?: string
    window_period?: string
  }>
}

/**
 * 是否应启用 AI 兜底：
 * - 标准模版输入：仅当模版转换 0 行时
 * - 非标准格式：直接走 AI
 */
export function shouldUseImportDraftAiFallback(input: {
  isTemplateInputFormat: boolean
  ruleRowCount: number
}): boolean {
  if (input.isTemplateInputFormat) {
    return input.ruleRowCount === 0
  }
  return true
}

function buildMasterDataHint(master: OrderImportMasterData): string {
  const amzCodes = master.locations
    .map((l) => l.location_code)
    .filter((code) => !NUMBERED_LOCATION_RE.test(code))
    .slice(0, 50)
  return JSON.stringify(
    {
      customerCodesSample: master.customers.slice(0, 40).map((c) => c.code),
      amzLocationCodesSample: amzCodes,
      pickupPool: listNumberedLocationCodes(master, 'pickup'),
      privatePool: listNumberedLocationCodes(master, 'private'),
      fedexPool: listNumberedLocationCodes(master, 'fedex'),
      destinationDefault: OAK_MAIN_WAREHOUSE_CODE,
    },
    null,
    2
  )
}

function buildConversionRulesPrompt(): string {
  return `## 硬转换规则（必须遵守）
1. **AMZ / 亚马逊仓**：按 (送仓地点 code, 性质) **汇总**为一行；FBA 格式 "FBA号##数量"，多 FBA 用换行分隔。
2. **私仓 / 自提 / FedEx**（性质含私仓、自提、fedex，或仓点无法匹配 AMZ code）：
   - **每个源明细单独一行**，不要汇总。
   - 送仓地点依次使用系统编号：自提→pickup1、pickup2…；私仓→private1、private2…；FedEx→fedex1、fedex2…
   - 性质写「私仓」；唛头写在明细备注，FBA 列写「唛头##数量」。
3. 订单头：拆柜时目的地=GG；直送时目的地=首个 AMZ 仓点或表内目的地。
4. 客户代码、AMZ 仓点 code 必须来自系统主数据样本；匹配不上时用最接近的 code。
5. 日期输出 yyyy-mm-dd；MBL 缺失时用「待补MBL」。`
}

async function callImportDraftGemini(input: {
  containerNumber: string
  sourcePreview: string
  filename: string
  emailSubject?: string | null
  masterHint: string
  ruleWarnings: string[]
  ruleRowCount: number
  parsedDetailCount: number
  correctionExamples: Awaited<ReturnType<typeof loadImportDraftCorrectionExamples>>
  fixedOrderDateKey?: string | null
  fixedCustomerCode?: string | null
}): Promise<AiImportDraftResponse> {
  const fixedHints: string[] = []
  if (input.fixedCustomerCode?.trim()) {
    fixedHints.push(`客户代码必须使用：${input.fixedCustomerCode.trim()}`)
  }
  if (input.fixedOrderDateKey?.trim()) {
    fixedHints.push(`订单日期必须使用：${input.fixedOrderDateKey.trim()}`)
  }

  const prompt = `目标柜号：${input.containerNumber}
源文件名：${input.filename}
邮件标题：${input.emailSubject?.trim() || '（无）'}

${buildConversionRulesPrompt()}

## 系统主数据（送仓地点/客户 code 须从中选取）
${input.masterHint}

${fixedHints.length ? `## 固定字段\n${fixedHints.join('\n')}\n` : ''}

## 规则引擎结果（供参考，可能不完整）
- 已解析源明细行：${input.parsedDetailCount}
- 规则成功输出行：${input.ruleRowCount}
- 规则警告：${input.ruleWarnings.slice(0, 12).join('；') || '无'}

## 同事纠正样例（学习硬规则偏好，按相关性参考）
${input.correctionExamples.length ? JSON.stringify(input.correctionExamples, null, 2) : '（暂无）'}

## 源 Excel 预览（前 25 行，制表符分隔）
${input.sourcePreview}

## 输出 JSON（不要其它文字）
{
  "usable": true,
  "reason": "一句话说明转换依据",
  "orderHeader": {
    "customer_code": "系统客户 code",
    "order_date": "yyyy-mm-dd",
    "operation_mode": "拆柜或直送",
    "destination_code": "GG 或 AMZ code",
    "container_type": "40DH 等",
    "eta": "yyyy-mm-dd",
    "mbl": "提单号或待补MBL"
  },
  "detailRows": [
    {
      "detail_delivery_location_code": "AMZ code 或 pickup1/private1",
      "delivery_nature": "AMZ 或 私仓",
      "quantity": 1,
      "volume": 0.5,
      "fba": "FBA123##10 或 唛头##10",
      "po": "",
      "detail_notes": "私仓唛头（AMZ 可空）",
      "window_period": ""
    }
  ]
}

若完全无法转换：{"usable":false,"reason":"原因","detailRows":[]}`

  const { text } = await geminiGenerateContent({
    systemInstruction:
      '你是 G&G 物流 ERP 的源预报→订单导入表转换助手。只输出合法 JSON。严格遵守 AMZ 汇总与 pickup/private 逐行规则。数量体积勿编造。',
    userPrompt: prompt,
    temperature: 0.1,
    jsonResponse: true,
  })

  return JSON.parse(text) as AiImportDraftResponse
}

function resolveDateField(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback
  const d = parseFlexibleDate(raw)
  return d ? dateToExcelSerial(d) : fallback
}

function isDedicatedNature(nature: string): boolean {
  return isPrivateWarehouseNature(nature) || nature === '私仓'
}

function isDedicatedLocationCode(code: string): boolean {
  return NUMBERED_LOCATION_RE.test(code.trim())
}

function normalizeAiImportRows(
  ai: AiImportDraftResponse,
  containerNumber: string,
  master: OrderImportMasterData,
  options: TransformOptions | undefined,
  warnings: string[]
): OrderImportDraftOutputRow[] {
  if (!ai.usable || !ai.detailRows?.length || !ai.orderHeader) return []

  const today = dateToExcelSerial(new Date())
  const headerRaw = ai.orderHeader

  let customerCode = String(headerRaw.customer_code ?? '').trim()
  const fixedCustomer = options?.fixedCustomerCode?.trim()
  if (fixedCustomer && master.customerByCode.has(fixedCustomer)) {
    customerCode = fixedCustomer
  } else {
    const matched = matchMasterCode(customerCode, master.customers)
    if (matched.code) customerCode = matched.code
    else if (master.customers[0]?.code) {
      warnings.push(`AI 客户「${customerCode || '(空)'}」未能匹配，已用 ${master.customers[0].code}`)
      customerCode = master.customers[0].code
    }
  }

  const operationMode = parseOperationModeLabel(String(headerRaw.operation_mode ?? ''))
  let destinationCode = String(headerRaw.destination_code ?? '').trim()
  const destMatch = matchMasterCode(
    destinationCode,
    master.locations.map((l) => ({ code: l.location_code, name: l.name }))
  )
  if (operationMode === '拆柜') {
    destinationCode = OAK_MAIN_WAREHOUSE_CODE
  } else if (destMatch.code) {
    destinationCode = destMatch.code
  } else if (!destinationCode) {
    destinationCode = OAK_MAIN_WAREHOUSE_CODE
  }

  const orderDateSerial = options?.fixedOrderDateKey?.trim()
    ? resolveDateField(options.fixedOrderDateKey, today)
    : resolveDateField(headerRaw.order_date, today)

  const etaSerial = resolveDateField(headerRaw.eta, orderDateSerial)
  const mbl = String(headerRaw.mbl ?? '').trim() || '待补MBL'
  const containerType = matchContainerType(String(headerRaw.container_type ?? ''))

  const baseHeader = {
    order_number: containerNumber,
    customer_code: customerCode,
    order_date_serial: orderDateSerial,
    operation_mode: operationMode,
    delivery_location_code: destinationCode,
    container_type: containerType,
    eta_serial: etaSerial,
    mbl_number: mbl,
    do_issued: '是' as const,
  }

  const locationItems = master.locations.map((l) => ({
    code: l.location_code,
    name: l.name,
  }))
  const pools = buildNumberedLocationPools(master)
  const counters: Record<DedicatedLocationSeries, number> = {
    pickup: 0,
    private: 0,
    fedex: 0,
  }

  const rawRows: OrderImportDraftOutputRow[] = []

  for (const detail of ai.detailRows) {
    const nature = matchDeliveryNature(String(detail.delivery_nature ?? ''))
    let locCode = String(detail.detail_delivery_location_code ?? '').trim()
    const notes = String(detail.detail_notes ?? '').trim()
    const qty = Math.max(1, Math.round(Number(detail.quantity) || 1))
    const vol = Math.max(0.01, Math.round((Number(detail.volume) || 0.01) * 100) / 100)

    const dedicated =
      isDedicatedNature(nature) ||
      isDedicatedLocationCode(locCode) ||
      (!locCode && notes) ||
      (locCode && !matchMasterCode(locCode, locationItems).code && nature !== 'AMZ')

    if (dedicated) {
      if (isDedicatedLocationCode(locCode)) {
        const series = classifyDedicatedLocationSeries({
          deliveryLocationRaw: locCode,
          deliveryNatureRaw: nature,
          shippingMarkRaw: notes,
          quantity: qty,
          weight: 0,
          volume: vol,
          fba: String(detail.fba ?? ''),
          po: String(detail.po ?? ''),
          windowPeriod: String(detail.window_period ?? ''),
        })
        counters[series] = Math.max(counters[series], parseInt(locCode.replace(/\D/g, ''), 10) || 1)
      } else {
        const series = classifyDedicatedLocationSeries({
          deliveryLocationRaw: locCode,
          deliveryNatureRaw: nature,
          shippingMarkRaw: notes,
          quantity: qty,
          weight: 0,
          volume: vol,
          fba: String(detail.fba ?? ''),
          po: String(detail.po ?? ''),
          windowPeriod: String(detail.window_period ?? ''),
        })
        const pool = pools[series]
        const idx = counters[series]
        counters[series] = idx + 1
        locCode = pool[idx] ?? locCode
        if (!pool[idx]) {
          warnings.push(`${series} 池已用尽，保留 AI 仓点 ${locCode || '(空)'}`)
        }
      }

      const mark = notes || locCode
      const fbaRaw = String(detail.fba ?? '').trim()
      const fba = fbaRaw.includes('##') ? fbaRaw : mark ? `${mark}##${qty}` : ''

      rawRows.push({
        ...baseHeader,
        detail_delivery_location_code: locCode,
        delivery_nature: PRIVATE_WAREHOUSE_NATURE,
        quantity: qty,
        volume: vol,
        fba,
        po: String(detail.po ?? '').trim(),
        detail_notes: mark,
        window_period: String(detail.window_period ?? '').trim(),
      })
      continue
    }

    const locMatch = matchMasterCode(locCode, locationItems)
    if (!locMatch.code) {
      warnings.push(`AI 行送仓地点「${locCode || '(空)'}」未能匹配，已跳过`)
      continue
    }

    const fbaRaw = String(detail.fba ?? '').trim()
    rawRows.push({
      ...baseHeader,
      detail_delivery_location_code: locMatch.code,
      delivery_nature: nature,
      quantity: qty,
      volume: vol,
      fba: fbaRaw,
      po: String(detail.po ?? '').trim(),
      detail_notes: notes,
      window_period: String(detail.window_period ?? '').trim(),
    })
  }

  return consolidateAmzRows(rawRows)
}

function consolidateAmzRows(rows: OrderImportDraftOutputRow[]): OrderImportDraftOutputRow[] {
  const dedicated = rows.filter(
    (r) => isDedicatedNature(r.delivery_nature) || isDedicatedLocationCode(r.detail_delivery_location_code)
  )
  const amzRows = rows.filter((r) => !dedicated.includes(r))

  const buckets = new Map<
    string,
    OrderImportDraftOutputRow & { fbaParts: Map<string, number>; poParts: string[] }
  >()

  for (const row of amzRows) {
    const key = `${row.detail_delivery_location_code}|${row.delivery_nature}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        ...row,
        fbaParts: new Map(),
        poParts: [],
      })
    }
    const bucket = buckets.get(key)!
    bucket.quantity += row.quantity
    bucket.volume = Math.round((bucket.volume + row.volume) * 100) / 100

    if (row.fba) {
      for (const part of row.fba.split('\n')) {
        const [fbaKey, qtyStr] = part.split('##')
        const fbaKeyTrim = fbaKey?.trim()
        if (!fbaKeyTrim) continue
        const addQty = parseInt(qtyStr ?? '', 10) || row.quantity
        bucket.fbaParts.set(fbaKeyTrim, (bucket.fbaParts.get(fbaKeyTrim) ?? 0) + addQty)
      }
    }
    if (row.po && !bucket.poParts.includes(row.po)) {
      bucket.poParts.push(row.po)
    }
    if (!bucket.window_period && row.window_period) {
      bucket.window_period = row.window_period
    }
  }

  const consolidatedAmz = Array.from(buckets.values()).map((b) => ({
    order_number: b.order_number,
    customer_code: b.customer_code,
    order_date_serial: b.order_date_serial,
    operation_mode: b.operation_mode,
    delivery_location_code: b.delivery_location_code,
    container_type: b.container_type,
    eta_serial: b.eta_serial,
    mbl_number: b.mbl_number,
    do_issued: b.do_issued,
    detail_delivery_location_code: b.detail_delivery_location_code,
    delivery_nature: b.delivery_nature,
    quantity: Math.max(1, Math.round(b.quantity)),
    volume: Math.max(0.01, Math.round(b.volume * 100) / 100),
    fba: Array.from(b.fbaParts.entries())
      .map(([k, q]) => `${k}##${q}`)
      .join('\n'),
    po: b.poParts.join('\n'),
    detail_notes: b.detail_notes,
    window_period: b.window_period,
  }))

  return [...consolidatedAmz, ...dedicated]
}

async function convertImportDraftWithAi(input: {
  containerNumber: string
  sourceBuffer: Buffer
  filename: string
  master: OrderImportMasterData
  parsed: ParsedSourceForecast
  ruleWarnings: string[]
  ruleRowCount: number
  options?: TransformOptions
}): Promise<{ rows: OrderImportDraftOutputRow[]; warnings: string[]; reason: string } | null> {
  if (!isForecastAiEnabled()) return null

  try {
    let correctionExamples = await loadImportDraftCorrectionExamples(input.containerNumber, 6)
    if (correctionExamples.length < 3) {
      const globalExamples = await loadImportDraftCorrectionExamples(undefined, 6)
      const seen = new Set(correctionExamples.map((e) => e.containerNumber))
      for (const ex of globalExamples) {
        if (seen.has(ex.containerNumber)) continue
        correctionExamples.push(ex)
        seen.add(ex.containerNumber)
        if (correctionExamples.length >= 6) break
      }
    }
    const sourcePreview = buildExcelPreviewForAi(input.sourceBuffer, 25)
    const ai = await callImportDraftGemini({
      containerNumber: input.containerNumber,
      sourcePreview,
      filename: input.filename,
      emailSubject: input.options?.emailSubject,
      masterHint: buildMasterDataHint(input.master),
      ruleWarnings: input.ruleWarnings,
      ruleRowCount: input.ruleRowCount,
      parsedDetailCount: input.parsed.details.length,
      correctionExamples,
      fixedOrderDateKey: input.options?.fixedOrderDateKey,
      fixedCustomerCode: input.options?.fixedCustomerCode,
    })

    const warnings: string[] = []
    const rows = normalizeAiImportRows(
      ai,
      input.containerNumber,
      input.master,
      input.options,
      warnings
    )

    if (!rows.length) {
      return {
        rows: [],
        warnings: [ai.reason || 'AI 未能产出可用明细'],
        reason: ai.reason || 'AI 未能产出可用明细',
      }
    }

    return {
      rows,
      warnings: [`AI 转换：${ai.reason || '已完成'}`, ...warnings],
      reason: ai.reason || 'AI 转换完成',
    }
  } catch (error) {
    console.error('import draft AI convert failed:', error)
    return {
      rows: [],
      warnings: [`AI 转换失败：${error instanceof Error ? error.message : 'unknown'}`],
      reason: error instanceof Error ? error.message : 'AI 转换失败',
    }
  }
}

/**
 * 标准模版 → 硬规则全量转换 → 对齐邮件助手客户/订单日期；
 * 非标准或模版转换失败 → Gemini 兜底。
 */
export async function transformSourceToImportRowsWithAiFallback(
  parsed: ParsedSourceForecast,
  containerNumber: string,
  master: OrderImportMasterData,
  sourceBuffer: Buffer,
  options?: TransformOptions & { filename?: string }
): Promise<ImportDraftTransformResult> {
  const isTemplateInputFormat = isSourceForecastTemplateInputFormat(parsed)
  const mailAssistantFields: MailAssistantRowFields = {
    fixedOrderDateKey: options?.fixedOrderDateKey,
    fixedCustomerCode: options?.fixedCustomerCode,
  }

  // 模版路径：转换时不注入 YG 客户/日期，转换后再覆盖
  const ruleTransformOptions = {
    emailSubject: options?.emailSubject,
    ...(isTemplateInputFormat
      ? {}
      : {
          fixedOrderDateKey: options?.fixedOrderDateKey,
          fixedCustomerCode: options?.fixedCustomerCode,
        }),
  }

  const ruleResult = transformSourceToImportRows(
    parsed,
    containerNumber,
    master,
    ruleTransformOptions
  )
  const { rows: ruleRows, warnings: ruleWarnings } = ruleResult

  if (isTemplateInputFormat) {
    ruleWarnings.unshift('源预报为标准客户填写模版，已使用模版硬转换')
  } else {
    ruleWarnings.unshift('源预报非标准模版格式，将尝试 AI 转换')
  }

  const needAi = shouldUseImportDraftAiFallback({
    isTemplateInputFormat,
    ruleRowCount: ruleRows.length,
  })

  if (!needAi) {
    const patchedRows = applyMailAssistantOrderFields(
      ruleRows,
      master,
      mailAssistantFields,
      ruleWarnings
    )
    return { rows: patchedRows, warnings: ruleWarnings, usedAi: false }
  }

  if (!isForecastAiEnabled()) {
    if (ruleRows.length > 0) {
      const patchedRows = applyMailAssistantOrderFields(
        ruleRows,
        master,
        mailAssistantFields,
        ruleWarnings
      )
      ruleWarnings.push('未配置 GEMINI_API_KEY，无法 AI 兜底，已保留模版/规则部分结果')
      return { rows: patchedRows, warnings: ruleWarnings, usedAi: false }
    }
    ruleWarnings.push('未配置 GEMINI_API_KEY，无法 AI 兜底')
    return { rows: [], warnings: ruleWarnings, usedAi: false }
  }

  const aiResult = await convertImportDraftWithAi({
    containerNumber,
    sourceBuffer,
    filename: options?.filename ?? 'source.xlsx',
    master,
    parsed,
    ruleWarnings,
    ruleRowCount: ruleRows.length,
    options,
  })

  if (aiResult?.rows.length) {
    const patchedRows = applyMailAssistantOrderFields(
      aiResult.rows,
      master,
      mailAssistantFields,
      aiResult.warnings
    )
    return {
      rows: patchedRows,
      warnings: [...ruleWarnings, ...aiResult.warnings],
      usedAi: true,
      aiReason: aiResult.reason,
    }
  }

  if (ruleRows.length > 0) {
    const patchedRows = applyMailAssistantOrderFields(
      ruleRows,
      master,
      mailAssistantFields,
      ruleWarnings
    )
    const extra = aiResult?.warnings ?? ['AI 兜底未产出有效行，已保留模版/规则部分结果']
    return {
      rows: patchedRows,
      warnings: [...ruleWarnings, ...extra],
      usedAi: false,
    }
  }

  return {
    rows: [],
    warnings: [...ruleWarnings, ...(aiResult?.warnings ?? ['AI 兜底失败'])],
    usedAi: Boolean(aiResult),
    aiReason: aiResult?.reason,
  }
}
