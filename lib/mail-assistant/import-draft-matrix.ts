export const IMPORT_EDITABLE_SHEET = '订单导入模板'

/** 裁剪可编辑行：保留表头 + 有数据的行 + 末尾 3 行空白供追加 */
export function trimImportEditableRows(matrix: string[][]): string[][] {
  if (matrix.length === 0) return matrix
  const header = matrix[0] ?? []
  const colCount = header.length
  const data = matrix.slice(1)

  let lastDataIdx = -1
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i] ?? []
    const hasValue = row.some((c) => String(c ?? '').trim())
    if (hasValue) {
      lastDataIdx = i
      break
    }
  }

  const endIdx = Math.min(Math.max(lastDataIdx + 4, 0), data.length - 1)
  const slice = data.slice(0, endIdx + 1).map((row) => {
    const padded = [...row.map((c) => String(c ?? ''))]
    while (padded.length < colCount) padded.push('')
    return padded.slice(0, colCount)
  })

  return [header.map((c) => String(c ?? '')), ...slice]
}
