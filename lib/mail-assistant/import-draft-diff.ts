import { trimImportEditableRows } from '@/lib/mail-assistant/import-draft-matrix'

/** 参与自动学习对比的关键列（0-based，与订单导入模板一致） */
export const TRACKED_IMPORT_COLUMNS: Array<{ index: number; label: string }> = [
  { index: 0, label: '订单号' },
  { index: 1, label: '客户代码' },
  { index: 2, label: '订单日期' },
  { index: 3, label: '操作方式' },
  { index: 4, label: '目的地' },
  { index: 5, label: '货柜类型' },
  { index: 6, label: 'ETA' },
  { index: 7, label: 'MBL' },
  { index: 20, label: '送仓地点' },
  { index: 21, label: '性质' },
  { index: 22, label: '数量' },
  { index: 23, label: '体积' },
]

export type ImportDraftFieldChange = {
  row: number
  field: string
  colIndex: number
  before: string
  after: string
}

export type ImportDraftDiffResult = {
  hasChanges: boolean
  fieldChanges: ImportDraftFieldChange[]
  beforeDetailRows: number
  afterDetailRows: number
  summary: string
}

function normalizeMatrix(matrix: string[][]): string[][] {
  return trimImportEditableRows(matrix.map((row) => row.map((c) => String(c ?? '').trim())))
}

function countDetailRows(matrix: string[][]): number {
  let count = 0
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const detailLoc = String(row[20] ?? '').trim()
    const orderNo = String(row[0] ?? '').trim()
    if (detailLoc || orderNo) count++
  }
  return count
}

function rowHasDetailData(row: string[]): boolean {
  const detailLoc = String(row[20] ?? '').trim()
  const orderNo = String(row[0] ?? '').trim()
  const qty = String(row[22] ?? '').trim()
  return Boolean(detailLoc || orderNo || qty)
}

/** 对比系统生成（baseline）与同事保存后的导入表矩阵 */
export function diffImportDraftMatrices(
  beforeMatrix: string[][],
  afterMatrix: string[][]
): ImportDraftDiffResult {
  const before = normalizeMatrix(beforeMatrix)
  const after = normalizeMatrix(afterMatrix)

  const fieldChanges: ImportDraftFieldChange[] = []
  const maxRows = Math.max(before.length, after.length)

  for (let i = 1; i < maxRows; i++) {
    const beforeRow = before[i] ?? []
    const afterRow = after[i] ?? []
    const rowInvolved = rowHasDetailData(beforeRow) || rowHasDetailData(afterRow)
    if (!rowInvolved && i >= Math.max(before.length, after.length)) continue

    for (const col of TRACKED_IMPORT_COLUMNS) {
      const b = String(beforeRow[col.index] ?? '').trim()
      const a = String(afterRow[col.index] ?? '').trim()
      if (b === a) continue
      fieldChanges.push({
        row: i + 1,
        field: col.label,
        colIndex: col.index,
        before: b,
        after: a,
      })
    }
  }

  const beforeDetailRows = countDetailRows(before)
  const afterDetailRows = countDetailRows(after)
  const hasChanges = fieldChanges.length > 0 || beforeDetailRows !== afterDetailRows

  const changedFields = [...new Set(fieldChanges.map((c) => c.field))]
  const summary = hasChanges
    ? changedFields.length > 0
      ? `同事修正 ${fieldChanges.length} 处（涉及：${changedFields.join('、')}）`
      : `明细行数 ${beforeDetailRows} → ${afterDetailRows}`
    : ''

  return {
    hasChanges,
    fieldChanges,
    beforeDetailRows,
    afterDetailRows,
    summary,
  }
}

/** 压缩为可放入 AI prompt 的纠正摘要 */
export function buildImportDraftCorrectionPreview(
  fieldChanges: ImportDraftFieldChange[],
  limit = 12
): Array<{ row: number; field: string; before: string; after: string }> {
  return fieldChanges.slice(0, limit).map(({ row, field, before, after }) => ({
    row,
    field,
    before: before.slice(0, 80),
    after: after.slice(0, 80),
  }))
}
