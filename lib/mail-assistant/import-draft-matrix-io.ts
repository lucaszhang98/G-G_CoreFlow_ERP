import * as XLSX from 'xlsx'
import { IMPORT_EDITABLE_SHEET } from '@/lib/mail-assistant/import-draft-matrix'

/** 从导入预报 Excel 缓冲区读取可编辑矩阵（字符串二维数组） */
export function extractImportDraftMatrix(buffer: Buffer): string[][] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = wb.Sheets[IMPORT_EDITABLE_SHEET] ?? wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  return matrix.map((row) => (row ?? []).map((cell) => String(cell ?? '').trim()))
}
