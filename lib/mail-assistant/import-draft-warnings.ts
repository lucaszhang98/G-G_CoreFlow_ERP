/** 写入 DB 的导入预报警告最大长度 */
export const MAX_IMPORT_DRAFT_WARNINGS_DB_LENGTH = 8000

/** HTTP 响应头中编码后警告的最大长度（常见代理/浏览器约 8KB） */
export const MAX_IMPORT_DRAFT_WARNINGS_HEADER_ENCODED_LENGTH = 1500

export function capImportDraftWarningsText(warnings: string): string {
  const text = warnings.trim()
  if (!text) return ''
  if (text.length <= MAX_IMPORT_DRAFT_WARNINGS_DB_LENGTH) return text

  const skipCount = (text.match(/已跳过/g) ?? []).length
  const suffix = `…（警告已截断，原文 ${text.length} 字${skipCount ? `，含 ${skipCount} 条跳过` : ''}）`
  const budget = Math.max(200, MAX_IMPORT_DRAFT_WARNINGS_DB_LENGTH - suffix.length)
  return `${text.slice(0, budget)}${suffix}`
}

export function encodeImportDraftWarningsHeader(warnings: string): string {
  const capped = capImportDraftWarningsText(warnings)
  if (!capped) return ''

  let encoded = encodeURIComponent(capped)
  if (encoded.length <= MAX_IMPORT_DRAFT_WARNINGS_HEADER_ENCODED_LENGTH) {
    return encoded
  }

  let sliceLen = Math.min(400, capped.length)
  while (sliceLen > 80) {
    const shorter = capImportDraftWarningsText(capped.slice(0, sliceLen))
    encoded = encodeURIComponent(shorter)
    if (encoded.length <= MAX_IMPORT_DRAFT_WARNINGS_HEADER_ENCODED_LENGTH) {
      return encoded
    }
    sliceLen = Math.floor(sliceLen * 0.7)
  }

  return encodeURIComponent('警告过多已省略，请查看转换日志')
}

export function joinImportDraftWarnings(warnings: string[]): string | null {
  const joined = warnings.map((w) => w.trim()).filter(Boolean).join('; ')
  if (!joined) return null
  return capImportDraftWarningsText(joined)
}

/** 大量重复警告合并为一条摘要，避免 DB / HTTP 头爆炸 */
export function appendSummarizedWarnings(
  target: string[],
  items: string[],
  summaryLabel: string,
  maxSamples = 5
): void {
  if (items.length === 0) return
  if (items.length <= maxSamples) {
    target.push(...items)
    return
  }
  const samples = items.slice(0, 3).join('；')
  target.push(`${summaryLabel}共 ${items.length} 条，已跳过（示例：${samples}…）`)
}
