/**
 * 从列表行批量复制私仓信息（private_warehouse_info），供订单明细、库存管理等复用。
 */

export type PrivateWarehouseInfoCopyFormat = 'line' | 'comma' | 'space'

export function getPrivateWarehouseInfoFromRow(
  row: Record<string, unknown>
): string | null {
  const raw = row.private_warehouse_info
  if (raw == null || raw === '') return null
  const text = String(raw).trim()
  return text.length > 0 ? text : null
}

export function buildPrivateWarehouseInfoCopyText(
  rows: Record<string, unknown>[],
  format: PrivateWarehouseInfoCopyFormat = 'line'
): { text: string; copiedCount: number; skippedCount: number } {
  const values: string[] = []
  let skippedCount = 0

  for (const row of rows) {
    const value = getPrivateWarehouseInfoFromRow(row)
    if (value) {
      values.push(value)
    } else {
      skippedCount++
    }
  }

  let text = ''
  switch (format) {
    case 'comma':
      text = values.join(', ')
      break
    case 'space':
      text = values.join(' ')
      break
    case 'line':
    default:
      text = values.join('\n')
      break
  }

  return { text, copiedCount: values.length, skippedCount }
}

export async function copyPrivateWarehouseInfoFromRows(
  rows: Record<string, unknown>[],
  format: PrivateWarehouseInfoCopyFormat = 'line'
): Promise<{ copiedCount: number; skippedCount: number }> {
  const { text, copiedCount, skippedCount } = buildPrivateWarehouseInfoCopyText(rows, format)

  if (copiedCount === 0) {
    return { copiedCount: 0, skippedCount: rows.length }
  }

  await navigator.clipboard.writeText(text)
  return { copiedCount, skippedCount }
}
