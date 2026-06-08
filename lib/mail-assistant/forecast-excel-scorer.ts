import * as XLSX from 'xlsx'
import {
  FORECAST_SCORE_THRESHOLD,
  ORDER_FORECAST_CANONICAL_HEADERS,
  PICKUP_TEMPLATE_HEADERS,
  headerMatchesCanonical,
  normalizeContainerNumber,
  normalizeHeaderCell,
} from '@/lib/mail-assistant/forecast-template-profile'

export type ForecastExcelScoreInput = {
  buffer: Buffer
  filename: string
  containerNumber: string
  emailSubject?: string
}

export type ForecastExcelScoreResult = {
  score: number
  containerFound: boolean
  sheetName: string | null
  matchedHeaders: string[]
  templateKind: 'order_forecast' | 'pickup_ops' | 'unknown'
  rowCountWithContainer: number
  reasons: string[]
}

const MAX_SCAN_ROWS = 80
const MAX_HEADER_SCAN_ROWS = 8

export function scoreForecastExcel(input: ForecastExcelScoreInput): ForecastExcelScoreResult {
  const container = normalizeContainerNumber(input.containerNumber)
  const reasons: string[] = []
  let best: ForecastExcelScoreResult = {
    score: 0,
    containerFound: false,
    sheetName: null,
    matchedHeaders: [],
    templateKind: 'unknown',
    rowCountWithContainer: 0,
    reasons: ['无法解析 Excel'],
  }

  try {
    const workbook = XLSX.read(input.buffer, { type: 'buffer', cellDates: true })
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      if (!rows.length) continue

      const scored = scoreSheet(rows, sheetName, container, input.filename, input.emailSubject)
      if (scored.score > best.score) best = scored
    }
  } catch (error) {
    best.reasons = [error instanceof Error ? error.message : 'Excel 解析失败']
  }

  return best
}

function scoreSheet(
  rows: unknown[][],
  sheetName: string,
  container: string,
  filename: string,
  emailSubject?: string
): ForecastExcelScoreResult {
  const reasons: string[] = []
  const headerInfo = findHeaderRow(rows)
  if (!headerInfo) {
    return {
      score: 0,
      containerFound: false,
      sheetName,
      matchedHeaders: [],
      templateKind: 'unknown',
      rowCountWithContainer: 0,
      reasons: ['未识别表头行'],
    }
  }

  const { headerRowIndex, headers } = headerInfo
  const matchedOrder = ORDER_FORECAST_CANONICAL_HEADERS.filter((h) =>
    headers.some((cell) => headerMatchesCanonical(String(cell), h))
  )
  const matchedPickup = PICKUP_TEMPLATE_HEADERS.filter((h) =>
    headers.some((cell) => headerMatchesCanonical(String(cell), h))
  )

  let score = 0
  score += Math.min(45, matchedOrder.length * 4)
  reasons.push(`订单模板字段命中 ${matchedOrder.length}/${ORDER_FORECAST_CANONICAL_HEADERS.length}`)

  let templateKind: ForecastExcelScoreResult['templateKind'] = 'unknown'
  if (matchedOrder.length >= 6) {
    templateKind = 'order_forecast'
    score += 10
    reasons.push('判定为订单预报模板')
  } else if (matchedPickup.length >= 4 && matchedOrder.length < 4) {
    templateKind = 'pickup_ops'
    score -= 18
    reasons.push('更像提柜作业表，降权')
  }

  const containerColIdx = headers.findIndex((cell) =>
    ['订单号', '柜号'].some((h) => headerMatchesCanonical(String(cell), h))
  )

  const rowCountWithContainer = countContainerRows(rows, headerRowIndex, containerColIdx, container)
  if (rowCountWithContainer > 0) {
    score += 35
    reasons.push(`表内命中柜号 ${rowCountWithContainer} 行`)
  }

  const fn = filename.toLowerCase()
  if (fn.includes(container.toLowerCase())) {
    score += 12
    reasons.push('文件名含柜号')
  }
  if (/预报|forecast|pre.?alert|booking/i.test(filename)) {
    score += 8
    reasons.push('文件名含预报关键词')
  }
  if (emailSubject && emailSubject.toUpperCase().includes(container)) {
    score += 4
    reasons.push('邮件主题含柜号')
  }

  if (/账单|invoice|工资|payroll|报表|report/i.test(filename) && matchedOrder.length < 4) {
    score -= 30
    reasons.push('文件名像非预报文档，降权')
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    containerFound: rowCountWithContainer > 0,
    sheetName,
    matchedHeaders: matchedOrder,
    templateKind,
    rowCountWithContainer,
    reasons,
  }
}

function findHeaderRow(rows: unknown[][]): { headerRowIndex: number; headers: unknown[] } | null {
  const limit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)
  let best: { headerRowIndex: number; headers: unknown[]; hits: number } | null = null

  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    const hits = ORDER_FORECAST_CANONICAL_HEADERS.filter((h) =>
      row.some((cell) => headerMatchesCanonical(String(cell), h))
    ).length
    const pickupHits = PICKUP_TEMPLATE_HEADERS.filter((h) =>
      row.some((cell) => headerMatchesCanonical(String(cell), h))
    ).length
    const totalHits = hits + pickupHits
    if (totalHits >= 3 && (!best || totalHits > best.hits)) {
      best = { headerRowIndex: i, headers: row, hits: totalHits }
    }
  }

  if (!best) return null
  return { headerRowIndex: best.headerRowIndex, headers: best.headers }
}

function countContainerRows(
  rows: unknown[][],
  headerRowIndex: number,
  containerColIdx: number,
  container: string
): number {
  let count = 0
  const end = Math.min(rows.length, headerRowIndex + 1 + MAX_SCAN_ROWS)
  for (let i = headerRowIndex + 1; i < end; i++) {
    const row = rows[i] ?? []
    if (containerColIdx >= 0) {
      const cell = normalizeContainerNumber(String(row[containerColIdx] ?? ''))
      if (cell === container) count++
      continue
    }
    if (row.some((cell) => normalizeContainerNumber(String(cell ?? '')) === container)) {
      count++
    }
  }
  return count
}

export function isConfidentForecastScore(score: number, containerFound: boolean): boolean {
  return containerFound && score >= FORECAST_SCORE_THRESHOLD.confident
}

export function needsAiTiebreak(scores: Array<{ score: number; containerFound: boolean }>): boolean {
  const viable = scores.filter(
    (s) => s.containerFound && s.score >= FORECAST_SCORE_THRESHOLD.aiTiebreak
  )
  if (viable.length <= 1) return false
  viable.sort((a, b) => b.score - a.score)
  return viable[0].score - viable[1].score < 15
}

/** 给 AI 的摘要：每个 sheet 前几行 */
export function buildExcelPreviewForAi(buffer: Buffer, maxRows = 6): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }) as unknown[][]
    return rows
      .slice(0, maxRows)
      .map((r) => (r as unknown[]).map((c) => String(c ?? '')).join('\t'))
      .join('\n')
  } catch {
    return '(无法预览)'
  }
}
