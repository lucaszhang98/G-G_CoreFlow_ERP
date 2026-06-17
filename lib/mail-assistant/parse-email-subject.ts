import { parseFlexibleDate } from '@/lib/mail-assistant/excel-date-serial'
import type { OrderImportMasterData } from '@/lib/mail-assistant/order-import-master-data'
import { parseOperationModeLabel } from '@/lib/mail-assistant/order-import-master-data'

export type EmailSubjectHints = {
  rawSubject: string
  customerRaw: string | null
  operationModeRaw: string | null
  etaRaw: string | null
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd|回复|转发)\s*[:：]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractOperationMode(subject: string): string | null {
  const norm = subject.toLowerCase()
  const hasChaiGui = /拆柜|拆箱|deconsolidat/i.test(norm)
  const hasZhiSong = /直送|direct\s*deliver|directdelivery/i.test(norm)
  if (hasZhiSong && !hasChaiGui) return '直送'
  if (hasChaiGui) return '拆柜'
  return null
}

const ETA_NEAR_PATTERN =
  /(?:eta|预计到港|到港|抵港|arrival|etd)[\s:：\-]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}[-/.月]\d{1,2}(?:日)?(?:[-/.]\d{2,4})?)/i

const DATE_CANDIDATE_PATTERN =
  /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|\d{1,2}[-/.月]\d{1,2}(?:日)?(?:[-/.]\d{2,4})?/g

function normalizeDateToken(raw: string): string | null {
  const token = raw
    .replace(/年|月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-')
    .trim()
  const d = parseFlexibleDate(token)
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function extractEta(subject: string): string | null {
  const etaNear = subject.match(ETA_NEAR_PATTERN)
  if (etaNear?.[1]) {
    const normalized = normalizeDateToken(etaNear[1])
    if (normalized) return normalized
  }

  const matches = subject.match(DATE_CANDIDATE_PATTERN) ?? []
  for (const m of matches) {
    const normalized = normalizeDateToken(m)
    if (normalized) return normalized
  }
  return null
}

/** 在标题中按客户名称/代码最长匹配 */
export function matchCustomerInEmailSubject(
  subject: string,
  master: OrderImportMasterData
): string | null {
  const cleaned = cleanSubject(subject)
  if (!cleaned) return null

  const candidates = [...master.customers].sort(
    (a, b) => Math.max(b.name.length, b.code.length) - Math.max(a.name.length, a.code.length)
  )

  for (const c of candidates) {
    const name = c.name.trim()
    if (name.length >= 2 && cleaned.includes(name)) return name
    const code = c.code.trim()
    if (code.length >= 2 && cleaned.toLowerCase().includes(code.toLowerCase())) return code
  }
  return null
}

export function parseEmailSubjectHints(
  subject: string,
  master?: OrderImportMasterData
): EmailSubjectHints {
  const rawSubject = subject.trim()
  const cleaned = cleanSubject(rawSubject)

  return {
    rawSubject,
    customerRaw: master ? matchCustomerInEmailSubject(cleaned, master) : null,
    operationModeRaw: extractOperationMode(cleaned),
    etaRaw: extractEta(cleaned),
  }
}

export function mergeEmailSubjectIntoOrderFields(input: {
  customerRaw: string
  operationModeRaw: string
  etaRaw: unknown
  emailSubject?: string | null
  master: OrderImportMasterData
  warnings: string[]
}): {
  customerRaw: string
  operationModeRaw: string
  etaRaw: unknown
} {
  const subject = input.emailSubject?.trim()
  if (!subject) {
    return {
      customerRaw: input.customerRaw,
      operationModeRaw: input.operationModeRaw,
      etaRaw: input.etaRaw,
    }
  }

  const hints = parseEmailSubjectHints(subject, input.master)
  const filled: string[] = []

  let customerRaw = input.customerRaw.trim()
  if (!customerRaw && hints.customerRaw) {
    customerRaw = hints.customerRaw
    filled.push('客户')
  }

  let operationModeRaw = input.operationModeRaw.trim()
  if (!operationModeRaw && hints.operationModeRaw) {
    operationModeRaw = hints.operationModeRaw
    filled.push('操作方式')
  } else if (
    operationModeRaw &&
    hints.operationModeRaw &&
    parseOperationModeLabel(operationModeRaw) !== parseOperationModeLabel(hints.operationModeRaw)
  ) {
    input.warnings.push(
      `邮件标题操作方式「${hints.operationModeRaw}」与 Excel「${operationModeRaw}」不一致，已采用 Excel`
    )
  }

  let etaRaw = input.etaRaw
  const etaEmpty =
    etaRaw == null ||
    (typeof etaRaw === 'string' && !etaRaw.trim()) ||
    (typeof etaRaw === 'number' && !Number.isFinite(etaRaw))
  if (etaEmpty && hints.etaRaw) {
    etaRaw = hints.etaRaw
    filled.push('ETA')
  }

  if (filled.length > 0) {
    input.warnings.push(`已从邮件标题补全：${filled.join('、')}`)
  }

  return { customerRaw, operationModeRaw, etaRaw }
}
