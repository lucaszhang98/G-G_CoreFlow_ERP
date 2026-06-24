import type { WorkSheet } from 'xlsx'
import * as XLSX from 'xlsx'
import {
  findForecastDetailHeader,
  type ForecastDetailColMap,
} from '@/lib/mail-assistant/forecast-detail-header'

function isBlankCell(value: unknown): boolean {
  return String(value ?? '').trim() === ''
}

export function sheetToRowMatrixRaw(sheet: WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][]
}

/** 箱数/体积/重量：合并格拆开时只保留左上角，避免汇总重复累加 */
export function buildMergeMasterOnlyColumns(colMap: ForecastDetailColMap): Set<number> {
  const masterOnly = new Set<number>()
  for (const key of ['quantity', 'volume', 'weight'] as const) {
    const idx = colMap[key]
    if (idx !== undefined) masterOnly.add(idx)
  }
  return masterOnly
}

export type SheetMergeExpandOptions = {
  /** 这些列合并区只保留左上角值，其余格留空 */
  masterOnlyColumns?: Set<number>
  /** 已读取的原始矩阵，可省略以重新 sheet_to_json */
  prefilledRows?: unknown[][]
}

/**
 * 将 sheet 读成二维数组并展开合并格。
 * 默认：合并区左上角值复制到范围内每一格（仓点、唛头等行级标识）。
 * masterOnlyColumns：箱数/体积/重量等汇总字段只保留左上角，不向下复制。
 */
export function sheetToRowMatrixExpanded(
  sheet: WorkSheet,
  options?: SheetMergeExpandOptions
): unknown[][] {
  const rows = options?.prefilledRows ?? sheetToRowMatrixRaw(sheet)
  const masterOnlyColumns = options?.masterOnlyColumns

  const merges = sheet['!merges']
  if (!merges?.length) return rows

  let maxRow = rows.length
  let maxCol = rows.reduce((max, row) => Math.max(max, (row ?? []).length), 0)
  for (const { e } of merges) {
    maxRow = Math.max(maxRow, e.r + 1)
    maxCol = Math.max(maxCol, e.c + 1)
  }

  const matrix: unknown[][] = []
  for (let r = 0; r < maxRow; r++) {
    const src = rows[r] ?? []
    const row: unknown[] = []
    for (let c = 0; c < maxCol; c++) {
      row[c] = src[c] ?? ''
    }
    matrix.push(row)
  }

  for (const { s, e } of merges) {
    const master = matrix[s.r]?.[s.c]
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        if (masterOnlyColumns?.has(c)) {
          if (r === s.r && c === s.c) {
            if (!isBlankCell(master)) matrix[r][c] = master
          } else {
            matrix[r][c] = ''
          }
          continue
        }
        if (isBlankCell(master)) continue
        matrix[r][c] = master
      }
    }
  }

  return matrix
}

/** 源预报明细：先识别表头，再按列类型展开合并格 */
export function sheetToForecastRowMatrix(sheet: WorkSheet): unknown[][] {
  const raw = sheetToRowMatrixRaw(sheet)
  const header = findForecastDetailHeader(raw)
  const masterOnlyColumns = header ? buildMergeMasterOnlyColumns(header.colMap) : undefined
  return sheetToRowMatrixExpanded(sheet, { prefilledRows: raw, masterOnlyColumns })
}
