import prisma from '@/lib/prisma'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'
import {
  buildGmailAttachmentDownloadPath,
  buildGmailMessageWebUrl,
} from '@/lib/google/gmail-forecast'
import { generateOrderImportDraftFromSource } from '@/lib/mail-assistant/generate-order-import-draft'
import {
  countImportDraftDetailRows,
  isImportDraftCacheStale,
} from '@/lib/mail-assistant/import-draft-buffer'
import { applyImportDraftMatrix } from '@/lib/mail-assistant/import-draft-editor'
import type { SourceForecastLookupResult } from '@/lib/mail-assistant/find-source-forecast'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export const FORECAST_RELOOKUP_INTERVAL_MS = 12 * 60 * 60 * 1000

function toPrismaBytes(buffer: Buffer) {
  return Uint8Array.from(buffer) as Uint8Array<ArrayBuffer>
}

export function buildImportDraftDownloadUrl(containerNumber: string): string {
  const cn = normalizeContainerNumber(containerNumber)
  return `/api/google/workspace/forecast-import-draft?containerNumber=${encodeURIComponent(cn)}`
}

export type PersistedForecastDto = {
  containerNumber: string
  status: 'found' | 'not_found'
  label?: string
  downloadUrl?: string
  gmailUrl?: string
  messageId?: string
  attachmentId?: string
  aiResolved?: boolean
  resolveReason?: string
  hasImportDraft: boolean
  importDraftDownloadUrl?: string
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
  workspaceEmail: string | null | undefined
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

  const importDraftDownloadUrl =
    row.import_draft_download_url ?? (found ? buildImportDraftDownloadUrl(cn) : undefined)

  return { downloadUrl, gmailUrl, importDraftDownloadUrl }
}

function toDto(row: {
  container_number: string
  status: string
  source_filename: string | null
  message_id: string | null
  thread_id: string | null
  attachment_id: string | null
  source_download_url: string | null
  gmail_url: string | null
  import_draft_download_url: string | null
  resolve_reason: string | null
  ai_resolved: boolean | null
  import_draft_data: Uint8Array | Buffer | null
  looked_up_at: Date
}, workspaceEmail: string | null | undefined): PersistedForecastDto {
  const cn = row.container_number
  const found = row.status === 'found'
  const { downloadUrl, gmailUrl, importDraftDownloadUrl } = resolveStoredUrls(row, workspaceEmail)

  return {
    containerNumber: cn,
    status: found ? 'found' : 'not_found',
    label: row.source_filename ?? undefined,
    downloadUrl,
    gmailUrl,
    messageId: row.message_id ?? undefined,
    attachmentId: row.attachment_id ?? undefined,
    aiResolved: row.ai_resolved ?? undefined,
    resolveReason: row.resolve_reason ?? undefined,
    hasImportDraft: Boolean(row.import_draft_data && row.import_draft_data.length > 0),
    importDraftDownloadUrl,
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
  detailRowCount?: number
  warnings?: string
  error?: string
}

/** 转换源预报 → 导入预报，并更新 DB 中的导入 Excel 超链接与缓存文件 */
export async function convertImportDraftForContainer(
  containerNumber: string
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

  try {
    const draft = await generateOrderImportDraftFromSource({
      containerNumber: cn,
      messageId: row.message_id,
      attachmentId: row.attachment_id,
      filename: row.source_filename ?? 'source.xlsx',
    })
    const importDraftDownloadUrl = buildImportDraftDownloadUrl(cn)
    await prisma.mail_container_forecast.update({
      where: { container_number: cn },
      data: {
        import_draft_data: toPrismaBytes(draft.buffer),
        import_draft_warnings: draft.warnings.join('; ') || null,
        import_draft_download_url: importDraftDownloadUrl,
        updated_at: new Date(),
      },
    })

    return {
      containerNumber: cn,
      status: 'converted',
      importDraftDownloadUrl,
      detailRowCount: countImportDraftDetailRows(draft.buffer),
      warnings: draft.warnings.join('; ') || undefined,
    }
  } catch (error) {
    return {
      containerNumber: cn,
      status: 'failed',
      error: error instanceof Error ? error.message : '转换失败',
    }
  }
}

export async function convertImportDraftsBatch(
  containerNumbers: string[],
  concurrency = 2
): Promise<ImportDraftConvertResult[]> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  const results: ImportDraftConvertResult[] = []
  let index = 0

  async function worker() {
    while (index < unique.length) {
      const i = index++
      const cn = unique[i]
      results.push(await convertImportDraftForContainer(cn))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker())
  )

  return results.sort(
    (a, b) => unique.indexOf(a.containerNumber) - unique.indexOf(b.containerNumber)
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
      message_id: string | null
      thread_id: string | null
      attachment_id: string | null
      source_download_url: string | null
      gmail_url: string | null
      import_draft_download_url: string | null
      resolve_reason: string | null
      ai_resolved: boolean | null
      import_draft_data: Buffer | null
      looked_up_at: Date
    }>
  >`
    SELECT
      container_number,
      status,
      source_filename,
      message_id,
      thread_id,
      attachment_id,
      source_download_url,
      gmail_url,
      import_draft_download_url,
      resolve_reason,
      ai_resolved,
      import_draft_data,
      looked_up_at
    FROM mail_container_forecast
    WHERE container_number = ANY(${unique}::text[])
  `
  return rows.map((row) => toDto(row, workspaceEmail))
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
    warnings: row.import_draft_warnings ?? '',
  }
}

async function persistImportDraft(
  cn: string,
  draft: { buffer: Buffer; warnings: string[] }
): Promise<void> {
  await prisma.mail_container_forecast.update({
    where: { container_number: cn },
    data: {
      import_draft_data: toPrismaBytes(draft.buffer),
      import_draft_warnings: draft.warnings.join('; ') || null,
      import_draft_download_url: buildImportDraftDownloadUrl(cn),
      updated_at: new Date(),
    },
  })
}

/** 读取导入预报；若缓存只有 1 行等陈旧数据则自动重新生成 */
export async function getImportDraftBuffer(
  containerNumber: string,
  options?: { forceRefresh?: boolean }
): Promise<{ buffer: Buffer; warnings: string; updatedAt: Date } | null> {
  const cn = normalizeContainerNumber(containerNumber)
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })
  if (!row || row.status !== 'found' || !row.message_id || !row.attachment_id) {
    return null
  }

  const cached =
    row.import_draft_data && row.import_draft_data.length > 0
      ? Buffer.from(row.import_draft_data)
      : null

  const needsRegen =
    options?.forceRefresh ||
    !cached ||
    isImportDraftCacheStale(cached)

  if (!needsRegen && cached) {
    return {
      buffer: cached,
      warnings: row.import_draft_warnings ?? '',
      updatedAt: row.updated_at,
    }
  }

  try {
    const draft = await generateOrderImportDraftFromSource({
      containerNumber: cn,
      messageId: row.message_id,
      attachmentId: row.attachment_id,
      filename: row.source_filename ?? 'source.xlsx',
    })
    await persistImportDraft(cn, draft)
    return {
      buffer: draft.buffer,
      warnings: draft.warnings.join('; '),
      updatedAt: new Date(),
    }
  } catch {
    if (cached) {
      return {
        buffer: cached,
        warnings: row.import_draft_warnings ?? '',
        updatedAt: row.updated_at,
      }
    }
    return null
  }
}

export async function ensureImportDraftCached(containerNumber: string): Promise<boolean> {
  const result = await getImportDraftBuffer(containerNumber)
  return Boolean(result)
}

/** 保存手动编辑后的导入预报矩阵 */
export async function saveImportDraftMatrix(
  containerNumber: string,
  rows: string[][]
): Promise<{ detailRowCount: number; updatedAt: Date }> {
  const cn = normalizeContainerNumber(containerNumber)
  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
    select: {
      import_draft_data: true,
      import_draft_warnings: true,
      status: true,
    },
  })

  if (!row || row.status !== 'found' || !row.import_draft_data?.length) {
    throw new Error('暂无导入预报，请先转换源预报')
  }

  const current = Buffer.from(row.import_draft_data)
  const updated = await applyImportDraftMatrix(current, rows)
  const warnings = row.import_draft_warnings?.split('; ').filter(Boolean) ?? []

  await prisma.mail_container_forecast.update({
    where: { container_number: cn },
    data: {
      import_draft_data: toPrismaBytes(updated),
      import_draft_warnings: warnings.join('; ') || null,
      import_draft_download_url: buildImportDraftDownloadUrl(cn),
      updated_at: new Date(),
    },
  })

  return {
    detailRowCount: countImportDraftDetailRows(updated),
    updatedAt: new Date(),
  }
}
