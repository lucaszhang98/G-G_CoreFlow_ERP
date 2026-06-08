import * as XLSX from 'xlsx'

export type ExcelSheetPreview = {
  name: string
  headers: string[]
  rows: string[][]
  totalRows: number
  totalCols: number
  truncated: boolean
}

export type ExcelPreviewPayload = {
  filename: string
  sheets: ExcelSheetPreview[]
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/** 将 Excel 二进制解析为可前端展示的表格预览 */
export function buildExcelPreviewPayload(
  buffer: Buffer,
  filename: string,
  options?: { maxRows?: number; maxCols?: number; maxSheets?: number }
): ExcelPreviewPayload {
  const maxRows = options?.maxRows ?? 80
  const maxCols = options?.maxCols ?? 24
  const maxSheets = options?.maxSheets ?? 3

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheets: ExcelSheetPreview[] = []

  for (const name of workbook.SheetNames.slice(0, maxSheets)) {
    const sheet = workbook.Sheets[name]
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]

    const normalized = matrix.map((row) =>
      (row as unknown[]).slice(0, maxCols).map(cellToString)
    )
    const colCount = normalized.reduce((max, row) => Math.max(max, row.length), 0)
    const padded = normalized.map((row) => {
      const next = [...row]
      while (next.length < colCount) next.push('')
      return next
    })

    const totalRows = padded.length
    const previewRows = padded.slice(0, maxRows)
    const headers =
      previewRows.length > 0
        ? previewRows[0].map((h, i) => (h.trim() ? h : `列${i + 1}`))
        : []
    const bodyRows = previewRows.length > 1 ? previewRows.slice(1) : []

    sheets.push({
      name,
      headers,
      rows: bodyRows,
      totalRows: Math.max(0, totalRows - 1),
      totalCols: colCount,
      truncated: totalRows > maxRows || workbook.SheetNames.length > maxSheets,
    })
  }

  return { filename, sheets }
}
