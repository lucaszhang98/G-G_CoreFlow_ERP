import type { WorkSheet } from 'xlsx'
import * as XLSX from 'xlsx'

function isBlankCell(value: unknown): boolean {
  return String(value ?? '').trim() === ''
}

/**
 * 将 sheet 读成二维数组，并把 Excel 合并单元格「拆开」：
 * 合并区左上角的值复制到范围内每个格子（与手动取消合并并填充相同）。
 */
export function sheetToRowMatrixExpanded(sheet: WorkSheet): unknown[][] {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][]

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
    if (isBlankCell(master)) continue
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        matrix[r][c] = master
      }
    }
  }

  return matrix
}
