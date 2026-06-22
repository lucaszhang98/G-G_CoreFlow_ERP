import prisma from '@/lib/prisma'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import {
  buildGmailAttachmentDownloadPath,
  buildGmailMessageWebUrl,
  getGmailMessageSubject,
} from '@/lib/google/gmail-forecast'
import {
  EMPTY_IMPORT_DRAFT_WARNING,
  generateEmptyOrderImportDraftBuffer,
  generateOrderImportDraftFromSource,
} from '@/lib/mail-assistant/generate-order-import-draft'
import {
  capImportDraftWarningsText,
  joinImportDraftWarnings,
} from '@/lib/mail-assistant/import-draft-warnings'
import { countImportDraftDetailRows } from '@/lib/mail-assistant/import-draft-buffer'
import { applyImportDraftMatrix } from '@/lib/mail-assistant/import-draft-editor'
import { diffImportDraftMatrices } from '@/lib/mail-assistant/import-draft-diff'
import { extractImportDraftMatrix } from '@/lib/mail-assistant/import-draft-matrix-io'
import { recordAutoImportDraftCorrection } from '@/lib/mail-assistant/forecast-feedback-store'
import type { SourceForecastLookupResult } from '@/lib/mail-assistant/find-source-forecast'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import {
  loadYg2025DateIndex,
  resolveYg2025CustomerCode,
  resolveYg2025OrderDateKey,
} from '@/lib/mail-assistant/yg2025-order-date'

export type ConvertImportDraftItem = {
  containerNumber: string
  orderDateKey?: string | null
  customerCode?: string | null
}

export const FORECAST_RELOOKUP_INTERVAL_MS = 12 * 60 * 60 * 1000

function toPrismaBytes(buffer: Buffer) {
  return Uint8Array.from(buffer) as Uint8Array<ArrayBuffer>
}

export function buildImportDraftDownloadUrl(containerNumber: string): string {
  const cn = normalizeContainerNumber(containerNumber)
  return `/api/google/workspace/forecast-import-draft?containerNumber=${encodeURIComponent(cn)}`
}

export function buildImportTemplateDownloadUrl(): string {
  return '/api/google/workspace/forecast-import-template'
}

export const IMPORT_DRAFT_CONVERT_FAILED_PREFIX = '转换失败：'

function countStoredImportDraftDetailRows(
  data: Uint8Array | Buffer | null | undefined
): number {
  if (!data?.length) return 0
  try {
    return countImportDraftDetailRows(Buffer.from(data))
  } catch {
    return 0
  }
}

function hasValidImportDraftData(data: Uint8Array | Buffer | null | undefined): boolean {
  return countStoredImportDraftDetailRows(data) > 0
}

function parseImportDraftConvertError(warnings: string | null | undefined): string | undefined {
  const text = warnings?.trim()
  if (!text?.startsWith(IMPORT_DRAFT_CONVERT_FAILED_PREFIX)) return undefined
  return text.slice(IMPORT_DRAFT_CONVERT_FAILED_PREFIX.length).trim() || '转换失败'
}

function isImportDraftFailureWarningPart(part: string): boolean {
  const trimmed = part.trim()
  if (!trimmed) return false
  if (trimmed.startsWith(IMPORT_DRAFT_CONVERT_FAILED_PREFIX)) return true
  return (
    trimmed.includes(EMPTY_IMPORT_DRAFT_WARNING) ||
    trimmed.includes('源预报未能自动转换') ||
    trimmed.includes('无法生成导入预报') ||
    trimmed.includes('无法从源预报解析')
  )
}

/** 手工保存有效导入表后，去掉陈旧的自动转换失败标记 */
export function sanitizeImportDraftWarningsAfterManualSave(
  existing: string | null | undefined,
  detailRowCount: number,
  manualCorrected: boolean
): string | null {
  if (detailRowCount <= 0) {
    return existing?.trim() || null
  }

  const kept = (existing ?? '')
    .split('; ')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => !isImportDraftFailureWarningPart(w))

  if (manualCorrected) {
    kept.push('导入预报已由同事手工纠正')
  }

  return kept.length ? kept.join('; ') : null
}

function isLegacyImportDraftFailureWarning(warnings: string): boolean {
  if (!warnings.trim()) return false
  return (
    warnings.includes(EMPTY_IMPORT_DRAFT_WARNING) ||
    warnings.includes('源预报未能自动转换') ||
    warnings.includes('无法生成导入预报') ||
    warnings.includes('无法从源预报解析')
  )
}

function extractLegacyImportDraftFailureError(warnings: string): string {
  const afterAutoConvert = warnings.match(/源预报未能自动转换：([^）]+)/)?.[1]
  if (afterAutoConvert?.trim()) return afterAutoConvert.trim()
  const cannotGenerate = warnings.match(/无法生成导入预报：([^；]+)/)?.[1]
  if (cannotGenerate?.trim()) return cannotGenerate.trim()
  if (warnings.includes('无法从源预报解析')) return '无法从源预报解析明细行'
  if (warnings.includes(EMPTY_IMPORT_DRAFT_WARNING)) return '未能自动生成导入预报'
  return warnings.slice(0, 200) || '转换失败'
}

/** 导入预报在列表/缓存 API 中的展示状态（兼容旧数据失败标记） */
export function resolveImportDraftDisplayState(row: {
  import_draft_data: Uint8Array | Buffer | null
  import_draft_warnings: string | null
  import_draft_baseline_data?: Uint8Array | Buffer | null
}): {
  hasImportDraft: boolean
  importDraftConvertFailed: boolean
  importDraftError?: string
} {
  const warnings = row.import_draft_warnings?.trim() ?? ''
  const detailRows = countStoredImportDraftDetailRows(row.import_draft_data)

  // 有效明细行优先：同事已手工保存时不应被陈旧「转换失败：」覆盖
  if (detailRows > 0) {
    return {
      hasImportDraft: true,
      importDraftConvertFailed: false,
    }
  }

  const explicitError = parseImportDraftConvertError(warnings)
  if (explicitError) {
    return {
      hasImportDraft: false,
      importDraftConvertFailed: true,
      importDraftError: explicitError,
    }
  }

  if (isLegacyImportDraftFailureWarning(warnings)) {
    return {
      hasImportDraft: false,
      importDraftConvertFailed: true,
      importDraftError: extractLegacyImportDraftFailureError(warnings),
    }
  }

  // 转换失败时写入空白模板且 baseline 为空
  if (
    row.import_draft_data?.length &&
    !row.import_draft_baseline_data?.length &&
    detailRows === 0
  ) {
    return {
      hasImportDraft: false,
      importDraftConvertFailed: true,
      importDraftError: warnings || '转换失败',
    }
  }

  return {
    hasImportDraft: detailRows > 0,
    importDraftConvertFailed: false,
  }
}

async function buildConvertResultAfterPersist(
  containerNumber: string
): Promise<ImportDraftConvertResult> {
  const cn = normalizeContainerNumber(containerNumber)
  const templateDownloadUrl = buildImportTemplateDownloadUrl()
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
    select: {
      import_draft_data: true,
      import_draft_baseline_data: true,
      import_draft_warnings: true,
      import_draft_download_url: true,
    },
  })

  if (!row) {
    return {
      containerNumber: cn,
      status: 'failed',
      error: '未找到预报记录',
      templateDownloadUrl,
    }
  }

  const state = resolveImportDraftDisplayState(row)
  if (state.importDraftConvertFailed || !state.hasImportDraft) {
    return {
      containerNumber: cn,
      status: 'failed',
      error: state.importDraftError ?? '转换失败',
      templateDownloadUrl,
    }
  }

  return {
    containerNumber: cn,
    status: 'converted',
    importDraftDownloadUrl:
      row.import_draft_download_url ?? buildImportDraftDownloadUrl(cn),
    detailRowCount: countStoredImportDraftDetailRows(row.import_draft_data),
    warnings: row.import_draft_warnings ?? undefined,
  }
}

export type PersistedForecastDto = {
  containerNumber: string
  status: 'found' | 'not_found'
  label?: string
  sourceEmailSubject?: string
  downloadUrl?: string
  gmailUrl?: string
  messageId?: string
  attachmentId?: string
  aiResolved?: boolean
  resolveReason?: string
  hasImportDraft: boolean
  importDraftConvertFailed?: boolean
  importDraftError?: string
  importDraftDownloadUrl?: string
  importTemplateDownloadUrl?: string
  lookedUpAt: string
}

function resolveStoredUrls(
  row: {
    container_number: string
    status: string
    source_filename: string | null
    message_id: string | null
    thread_id: string | null
    attachment_id: string | null
    source_download_url: string | null
    gmail_url: string | null
    import_draft_download_url: string | null
  },
  workspaceEmail: string | null | undefined,
  hasImportDraft: boolean
) {
  const cn = row.container_number
  const found = row.status === 'found'

  const downloadUrl =
    row.source_download_url ??
    (found && row.message_id && row.attachment_id
      ? buildGmailAttachmentDownloadPath(
          row.message_id,
          row.attachment_id,
          row.source_filename ?? 'source.xlsx'
        )
      : undefined)

  const gmailUrl = row.message_id
    ? buildGmailMessageWebUrl(row.message_id, workspaceEmail, row.thread_id)
    : undefined

  const importTemplateDownloadUrl = found ? buildImportTemplateDownloadUrl() : undefined
  const importDraftDownloadUrl = hasImportDraft
    ? row.import_draft_download_url ?? buildImportDraftDownloadUrl(cn)
    : undefined

  return { downloadUrl, gmailUrl, importDraftDownloadUrl, importTemplateDownloadUrl }
}

function toDto(row: {
  container_number: string
  status: string
  source_filename: string | null
  source_email_subject?: string | null
  message_id: string | null
  thread_id: string | null
  attachment_id: string | null
  source_download_url: string | null
  gmail_url: string | null
  import_draft_download_url: string | null
  resolve_reason: string | null
  ai_resolved: boolean | null
  import_draft_data: Uint8Array | Buffer | null
  import_draft_baseline_data?: Uint8Array | Buffer | null
  import_draft_warnings: string | null
  looked_up_at: Date
}, workspaceEmail: string | null | undefined): PersistedForecastDto {
  const cn = row.container_number
  const found = row.status === 'found'
  const draftState = resolveImportDraftDisplayState(row)
  const { hasImportDraft, importDraftConvertFailed, importDraftError } = draftState
  const { downloadUrl, gmailUrl, importDraftDownloadUrl, importTemplateDownloadUrl } =
    resolveStoredUrls(row, workspaceEmail, hasImportDraft)

  return {
    containerNumber: cn,
    status: found ? 'found' : 'not_found',
    label: row.source_filename ?? undefined,
    sourceEmailSubject: row.source_email_subject ?? undefined,
    downloadUrl,
    gmailUrl,
    messageId: row.message_id ?? undefined,
    attachmentId: row.attachment_id ?? undefined,
    aiResolved: row.ai_resolved ?? undefined,
    resolveReason: row.resolve_reason ?? undefined,
    hasImportDraft,
    importDraftConvertFailed,
    importDraftError,
    importDraftDownloadUrl,
    importTemplateDownloadUrl,
    lookedUpAt: row.looked_up_at.toISOString(),
  }
}

/** 找预报：仅持久化源 Excel / Gmail 链接，不生成导入预报 */
export async function upsertSourceForecastLookupResult(
  result: SourceForecastLookupResult
): Promise<void> {
  const cn = normalizeContainerNumber(result.containerNumber)
  const sf = result.sourceForecast
  const found = result.status === 'found' && sf
  const resolveReason = sf?.resolveReason ?? result.resolveReason ?? null
  const now = new Date()

  const { email: workspaceEmail } = await getGoogleWorkspaceConnectionStatus()
  const gmailUrl =
    found && sf?.messageId
      ? buildGmailMessageWebUrl(sf.messageId, workspaceEmail, sf.threadId)
      : null

  const sourceDownloadUrl = found && sf ? sf.downloadUrl : null

  await prisma.$executeRaw`
    INSERT INTO mail_container_forecast (
      container_number,
      status,
      source_filename,
      source_email_subject,
      message_id,
      thread_id,
      attachment_id,
      source_download_url,
      gmail_url,
      resolve_reason,
      ai_resolved,
      score,
      looked_up_at,
      created_at,
      updated_at
    ) VALUES (
      ${cn},
      ${result.status},
      ${sf?.filename ?? null},
      ${sf?.emailSubject ?? null},
      ${sf?.messageId ?? null},
      ${sf?.threadId ?? null},
      ${sf?.attachmentId ?? null},
      ${sourceDownloadUrl},
      ${gmailUrl},
      ${resolveReason},
      ${sf?.aiResolved ?? false},
      ${sf?.score ?? null},
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT (container_number) DO UPDATE SET
      status = EXCLUDED.status,
      source_filename = EXCLUDED.source_filename,
      source_email_subject = EXCLUDED.source_email_subject,
      message_id = EXCLUDED.message_id,
      thread_id = EXCLUDED.thread_id,
      attachment_id = EXCLUDED.attachment_id,
      source_download_url = EXCLUDED.source_download_url,
      gmail_url = EXCLUDED.gmail_url,
      resolve_reason = EXCLUDED.resolve_reason,
      ai_resolved = EXCLUDED.ai_resolved,
      score = EXCLUDED.score,
      looked_up_at = EXCLUDED.looked_up_at,
      updated_at = EXCLUDED.updated_at
  `
}

/** @deprecated 使用 upsertSourceForecastLookupResult */
export const upsertForecastLookupResult = upsertSourceForecastLookupResult

export type ImportDraftConvertResult = {
  containerNumber: string
  status: 'converted' | 'skipped' | 'failed'
  importDraftDownloadUrl?: string
  templateDownloadUrl?: string
  detailRowCount?: number
  warnings?: string
  error?: string
}

/** 转换源预报 → 导入预报，并更新 DB 中的导入 Excel 超链接与缓存文件 */
export async function convertImportDraftForContainer(
  containerNumber: string,
  options?: {
    orderDateKey?: string | null
    customerCode?: string | null
    ygDateIndex?: Awaited<ReturnType<typeof loadYg2025DateIndex>>
  }
): Promise<ImportDraftConvertResult> {
  const cn = normalizeContainerNumber(containerNumber)
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })

  if (!row || row.status !== 'found' || !row.message_id || !row.attachment_id) {
    return {
      containerNumber: cn,
      status: 'skipped',
      error: '请先完成找预报',
    }
  }

  const ygIndex = options?.ygDateIndex ?? (await loadYg2025DateIndex())
  const orderDateHint = options?.orderDateKey ?? row.yg_order_date_key
  const fixedOrderDateKey =
    resolveYg2025OrderDateKey(ygIndex, cn, orderDateHint) ?? orderDateHint ?? null
  const fixedCustomerCode =
    resolveYg2025CustomerCode(ygIndex, cn, orderDateHint, options?.customerCode) ?? null

  try {
    const draft = await generateOrderImportDraftFromSource({
      containerNumber: cn,
      messageId: row.message_id,
      attachmentId: row.attachment_id,
      filename: row.source_filename ?? 'source.xlsx',
      emailSubject: row.source_email_subject,
      fixedOrderDateKey,
      fixedCustomerCode,
    })
    const detailRowCount = countImportDraftDetailRows(draft.buffer)
    if (detailRowCount <= 0) {
      throw new Error('未能生成有效导入明细')
    }
    const importDraftDownloadUrl = buildImportDraftDownloadUrl(cn)
    const draftBytes = toPrismaBytes(draft.buffer)
    await prisma.mail_container_forecast.update({
      where: { container_number: cn },
      data: {
        import_draft_data: draftBytes,
        import_draft_baseline_data: draftBytes,
        import_draft_warnings: joinImportDraftWarnings(draft.warnings),
        import_draft_download_url: importDraftDownloadUrl,
        ...(fixedOrderDateKey ? { yg_order_date_key: fixedOrderDateKey } : {}),
        updated_at: new Date(),
      },
    })

    return buildConvertResultAfterPersist(cn)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '转换失败'
    const templateDownloadUrl = buildImportTemplateDownloadUrl()
    let failurePersisted = false
    try {
      const templateBuffer = await generateEmptyOrderImportDraftBuffer()
      await prisma.mail_container_forecast.update({
        where: { container_number: cn },
        data: {
          import_draft_data: toPrismaBytes(templateBuffer),
          import_draft_baseline_data: null,
          import_draft_warnings: `${IMPORT_DRAFT_CONVERT_FAILED_PREFIX}${errMsg}`,
          import_draft_download_url: null,
          ...(fixedOrderDateKey ? { yg_order_date_key: fixedOrderDateKey } : {}),
          updated_at: new Date(),
        },
      })
      failurePersisted = true
    } catch (persistError) {
      console.error(`persist empty template after convert fail (${cn}):`, persistError)
    }
    if (failurePersisted) {
      return buildConvertResultAfterPersist(cn)
    }
    return {
      containerNumber: cn,
      status: 'failed',
      error: errMsg,
      templateDownloadUrl,
    }
  }
}

export async function convertImportDraftsBatch(
  items: ConvertImportDraftItem[] | string[],
  concurrency = 2
): Promise<ImportDraftConvertResult[]> {
  const normalized: ConvertImportDraftItem[] = items.map((item) =>
    typeof item === 'string'
      ? { containerNumber: normalizeContainerNumber(item) }
      : {
          containerNumber: normalizeContainerNumber(item.containerNumber),
          orderDateKey: item.orderDateKey?.trim() || undefined,
          customerCode: item.customerCode?.trim() || undefined,
        }
  )
  const unique: ConvertImportDraftItem[] = []
  const seen = new Set<string>()
  for (const item of normalized) {
    const dedupeKey = `${item.containerNumber}|${item.orderDateKey ?? ''}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    unique.push(item)
  }

  const ygDateIndex = await loadYg2025DateIndex()
  const results: ImportDraftConvertResult[] = []
  let index = 0

  async function worker() {
    while (index < unique.length) {
      const i = index++
      const item = unique[i]
      results.push(
        await convertImportDraftForContainer(item.containerNumber, {
          orderDateKey: item.orderDateKey,
          customerCode: item.customerCode,
          ygDateIndex,
        })
      )
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker())
  )

  return results.sort(
    (a, b) =>
      unique.findIndex((u) => u.containerNumber === a.containerNumber) -
      unique.findIndex((u) => u.containerNumber === b.containerNumber)
  )
}

export async function loadPersistedForecasts(
  containerNumbers: string[]
): Promise<PersistedForecastDto[]> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  if (unique.length === 0) return []

  const { email: workspaceEmail } = await getGoogleWorkspaceConnectionStatus()

  const rows = await prisma.$queryRaw<
    Array<{
      container_number: string
      status: string
      source_filename: string | null
      source_email_subject: string | null
      message_id: string | null
      thread_id: string | null
      attachment_id: string | null
      source_download_url: string | null
      gmail_url: string | null
      import_draft_download_url: string | null
      resolve_reason: string | null
      ai_resolved: boolean | null
      import_draft_data: Buffer | null
      import_draft_baseline_data: Buffer | null
      import_draft_warnings: string | null
      looked_up_at: Date
    }>
  >`
    SELECT
      container_number,
      status,
      source_filename,
      source_email_subject,
      message_id,
      thread_id,
      attachment_id,
      source_download_url,
      gmail_url,
      import_draft_download_url,
      resolve_reason,
      ai_resolved,
      import_draft_data,
      import_draft_baseline_data,
      import_draft_warnings,
      looked_up_at
    FROM mail_container_forecast
    WHERE container_number = ANY(${unique}::text[])
  `

  await backfillMissingEmailSubjects(rows)
  await reconcileStaleImportDraftUrls(rows)

  return rows.map((row) => toDto(row, workspaceEmail))
}

/** 迁移脚本曾为所有 found 行写入导入链接；此处清理无有效导入预报的脏 URL */
async function reconcileStaleImportDraftUrls(
  rows: Array<{
    container_number: string
    import_draft_download_url: string | null
    import_draft_data: Buffer | null
    import_draft_baseline_data: Buffer | null
    import_draft_warnings: string | null
  }>
): Promise<void> {
  const toClear = rows.filter((row) => {
    if (!row.import_draft_download_url) return false
    const state = resolveImportDraftDisplayState(row)
    return !state.hasImportDraft
  })
  if (toClear.length === 0) return

  await Promise.all(
    toClear.map((row) =>
      prisma.mail_container_forecast.update({
        where: { container_number: row.container_number },
        data: { import_draft_download_url: null, updated_at: new Date() },
      })
    )
  )
}

/** 历史记录在加字段前找过预报的，按 message_id 补抓邮件标题 */
async function backfillMissingEmailSubjects(
  rows: Array<{
    container_number: string
    status: string
    message_id: string | null
    source_email_subject: string | null
  }>
): Promise<void> {
  const missing = rows.filter(
    (r) => r.status === 'found' && r.message_id && !r.source_email_subject?.trim()
  )
  if (missing.length === 0) return

  const batch = missing.slice(0, 40)
  await Promise.all(
    batch.map(async (row) => {
      if (!row.message_id) return
      try {
        const subject = (await getGmailMessageSubject(row.message_id)).trim()
        if (!subject) return
        row.source_email_subject = subject
        await prisma.mail_container_forecast.update({
          where: { container_number: row.container_number },
          data: { source_email_subject: subject, updated_at: new Date() },
        })
      } catch (error) {
        console.warn(`backfill email subject failed for ${row.container_number}:`, error)
      }
    })
  )
}

export function needsForecastRelookup(
  row: { status: string; looked_up_at: Date } | null | undefined,
  now = Date.now()
): boolean {
  if (!row) return true
  if (row.status === 'found') return false
  return now - row.looked_up_at.getTime() >= FORECAST_RELOOKUP_INTERVAL_MS
}

/** 柜号列表中需要重新找预报的（无源预报或 not_found 且超过 12h） */
export async function listContainersDueForLookup(
  containerNumbers: string[]
): Promise<string[]> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  if (unique.length === 0) return []

  const existing = await prisma.mail_container_forecast.findMany({
    where: { container_number: { in: unique } },
    select: { container_number: true, status: true, looked_up_at: true },
  })
  const map = new Map(existing.map((r) => [r.container_number, r]))
  const now = Date.now()

  return unique.filter((cn) => needsForecastRelookup(map.get(cn) ?? null, now))
}

export async function getCachedImportDraft(
  containerNumber: string
): Promise<{ buffer: Buffer; warnings: string } | null> {
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: normalizeContainerNumber(containerNumber) },
    select: {
      import_draft_data: true,
      import_draft_warnings: true,
      status: true,
    },
  })
  if (!row?.import_draft_data || row.status !== 'found') return null
  return {
    buffer: Buffer.from(row.import_draft_data),
    warnings: capImportDraftWarningsText(row.import_draft_warnings ?? ''),
  }
}

async function persistImportDraft(
  cn: string,
  draft: { buffer: Buffer; warnings: string[] }
): Promise<void> {
  const draftBytes = toPrismaBytes(draft.buffer)
  await prisma.mail_container_forecast.update({
    where: { container_number: cn },
    data: {
      import_draft_data: draftBytes,
      import_draft_baseline_data: draftBytes,
      import_draft_warnings: joinImportDraftWarnings(draft.warnings),
      import_draft_download_url: buildImportDraftDownloadUrl(cn),
      updated_at: new Date(),
    },
  })
}

/** 读取导入预报：默认仅返回已缓存文件或空白模板；仅 refresh=1 时才会重新拉 Gmail 转换 */
export async function getImportDraftBuffer(
  containerNumber: string,
  options?: { forceRefresh?: boolean }
): Promise<{ buffer: Buffer; warnings: string; updatedAt: Date } | null> {
  const cn = normalizeContainerNumber(containerNumber)
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })
  if (!row || row.status !== 'found') {
    return null
  }

  try {
    if (!row.message_id || !row.attachment_id) {
      return await buildEmptyImportDraftPayload()
    }

    const messageId = row.message_id
    const attachmentId = row.attachment_id

    const cached =
      row.import_draft_data && row.import_draft_data.length > 0
        ? Buffer.from(row.import_draft_data)
        : null
    const detailRows = cached ? countImportDraftDetailRows(cached) : 0
    const hasValidCache = Boolean(cached && detailRows > 0)

    if (options?.forceRefresh) {
      return await regenerateImportDraftFromSource(
        cn,
        {
          message_id: messageId,
          attachment_id: attachmentId,
          source_filename: row.source_filename,
          source_email_subject: row.source_email_subject,
          yg_order_date_key: row.yg_order_date_key,
          import_draft_warnings: row.import_draft_warnings,
          updated_at: row.updated_at,
        },
        cached
      )
    }

    if (hasValidCache && cached) {
      return {
        buffer: cached,
        warnings: capImportDraftWarningsText(row.import_draft_warnings ?? ''),
        updatedAt: row.updated_at,
      }
    }

    return await buildEmptyImportDraftPayload()
  } catch (error) {
    console.error(`getImportDraftBuffer(${cn}) error:`, error)
    return await buildEmptyImportDraftPayload()
  }
}

async function buildEmptyImportDraftPayload(
  warnings: string = EMPTY_IMPORT_DRAFT_WARNING
): Promise<{ buffer: Buffer; warnings: string; updatedAt: Date }> {
  return {
    buffer: await generateEmptyOrderImportDraftBuffer(),
    warnings,
    updatedAt: new Date(),
  }
}

async function regenerateImportDraftFromSource(
  cn: string,
  row: {
    message_id: string
    attachment_id: string
    source_filename: string | null
    source_email_subject: string | null
    yg_order_date_key: string | null
    import_draft_warnings: string | null
    updated_at: Date
  },
  cached: Buffer | null
): Promise<{ buffer: Buffer; warnings: string; updatedAt: Date }> {
  try {
    const ygIndex = await loadYg2025DateIndex()
    const orderDateHint = row.yg_order_date_key ?? null
    const fixedOrderDateKey = resolveYg2025OrderDateKey(ygIndex, cn, orderDateHint) ?? orderDateHint
    const fixedCustomerCode = resolveYg2025CustomerCode(ygIndex, cn, orderDateHint) ?? null
    const draft = await generateOrderImportDraftFromSource({
      containerNumber: cn,
      messageId: row.message_id,
      attachmentId: row.attachment_id,
      filename: row.source_filename ?? 'source.xlsx',
      emailSubject: row.source_email_subject,
      fixedOrderDateKey,
      fixedCustomerCode,
    })
    await persistImportDraft(cn, draft)
    return {
      buffer: draft.buffer,
      warnings: capImportDraftWarningsText(draft.warnings.join('; ')),
      updatedAt: new Date(),
    }
  } catch (error) {
    if (cached && countImportDraftDetailRows(cached) > 0) {
      return {
        buffer: cached,
        warnings: capImportDraftWarningsText(row.import_draft_warnings ?? ''),
        updatedAt: row.updated_at,
      }
    }
    const detail = error instanceof Error ? error.message : '转换失败'
    return buildEmptyImportDraftPayload(
      `${EMPTY_IMPORT_DRAFT_WARNING}（源预报未能自动转换：${detail}）`
    )
  }
}

export async function ensureImportDraftCached(containerNumber: string): Promise<boolean> {
  const result = await getImportDraftBuffer(containerNumber)
  return Boolean(result)
}

/** 保存手动编辑后的导入预报矩阵；若与系统 baseline 有差异则自动记入训练样例 */
export async function saveImportDraftMatrix(
  containerNumber: string,
  rows: string[][],
  options?: { createdBy?: bigint | null }
): Promise<{ detailRowCount: number; updatedAt: Date; trainingRecorded: boolean }> {
  const cn = normalizeContainerNumber(containerNumber)
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
    select: {
      import_draft_data: true,
      import_draft_baseline_data: true,
      import_draft_warnings: true,
      source_filename: true,
      status: true,
    },
  })

  if (!row || row.status !== 'found' || !row.import_draft_data?.length) {
    throw new Error('暂无导入预报，请先转换源预报')
  }

  const current = Buffer.from(row.import_draft_data)
  const baselineBuffer =
    row.import_draft_baseline_data && row.import_draft_baseline_data.length > 0
      ? Buffer.from(row.import_draft_baseline_data)
      : current

  const diff = diffImportDraftMatrices(extractImportDraftMatrix(baselineBuffer), rows)
  const updated = await applyImportDraftMatrix(current, rows)
  const detailRowCount = countImportDraftDetailRows(updated)
  const warnings = sanitizeImportDraftWarningsAfterManualSave(
    row.import_draft_warnings,
    detailRowCount,
    diff.hasChanges
  )

  await prisma.mail_container_forecast.update({
    where: { container_number: cn },
    data: {
      import_draft_data: toPrismaBytes(updated),
      import_draft_warnings: warnings,
      import_draft_download_url: buildImportDraftDownloadUrl(cn),
      updated_at: new Date(),
    },
  })

  let trainingRecorded = false
  if (diff.hasChanges) {
    await recordAutoImportDraftCorrection({
      containerNumber: cn,
      sourceFilename: row.source_filename,
      fieldChanges: diff.fieldChanges,
      summary: diff.summary,
      beforeDetailRows: diff.beforeDetailRows,
      afterDetailRows: diff.afterDetailRows,
      correctedFileBuffer: updated,
      createdBy: options?.createdBy ?? null,
    })
    trainingRecorded = true
  }

  return {
    detailRowCount,
    updatedAt: new Date(),
    trainingRecorded,
  }
}
