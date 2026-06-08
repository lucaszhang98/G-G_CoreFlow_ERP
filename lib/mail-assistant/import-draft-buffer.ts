import * as XLSX from 'xlsx'

/** 统计导入预报工作表中有效明细行数（送仓地点列有值） */
export function countImportDraftDetailRows(buffer: Buffer): number {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets['订单导入模板'] ?? wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return 0
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][]
    let count = 0
    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i] ?? []
      const detailLoc = String(row[20] ?? '').trim()
      const orderNo = String(row[0] ?? '').trim()
      if (detailLoc || orderNo) count++
    }
    return count
  } catch {
    return 0
  }
}

export function isImportDraftCacheStale(buffer: Buffer): boolean {
  return countImportDraftDetailRows(buffer) <= 1
}
