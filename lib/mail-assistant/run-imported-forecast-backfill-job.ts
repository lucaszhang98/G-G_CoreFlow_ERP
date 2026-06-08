import { fetchYg2025ImportCheck } from '@/lib/google/oak-yg2025-sheet'
import { findSourceForecastsBatch } from '@/lib/mail-assistant/find-source-forecast'
import {
  convertImportDraftForContainer,
  upsertSourceForecastLookupResult,
} from '@/lib/mail-assistant/forecast-persistence'
import { isImportDraftCacheStale } from '@/lib/mail-assistant/import-draft-buffer'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import prisma from '@/lib/prisma'

export const IMPORTED_BACKFILL_DEFAULT_BATCH_SIZE = 8
export const IMPORTED_BACKFILL_DEFAULT_CONCURRENCY = 2

export type ImportedForecastBackfillPhase = 'all' | 'source' | 'import'

export type ImportedForecastBackfillResult = {
  importedTotal: number
  needSourceLookup: number
  needImportDraft: number
  sourceProcessed: number
  sourceFound: number
  sourceNotFound: number
  sourceErrors: number
  importProcessed: number
  importConverted: number
  importSkipped: number
  importFailed: number
  durationMs: number
  dryRun: boolean
}

type ForecastRow = {
  container_number: string
  status: string
  message_id: string | null
  attachment_id: string | null
  import_draft_data: Uint8Array | Buffer | null
}

export function needsSourceForecastBackfill(row: ForecastRow | undefined): boolean {
  if (!row) return true
  if (row.status !== 'found') return true
  if (!row.message_id || !row.attachment_id) return true
  return false
}

export function needsImportDraftBackfill(row: ForecastRow | undefined): boolean {
  if (!row) return false
  if (row.status !== 'found' || !row.message_id || !row.attachment_id) return false
  if (!row.import_draft_data || row.import_draft_data.length === 0) return true
  return isImportDraftCacheStale(Buffer.from(row.import_draft_data))
}

export async function listImportedContainersForBackfill(): Promise<{
  importedContainers: string[]
  importedTotal: number
}> {
  const sheet = await fetchYg2025ImportCheck()
  const importedContainers = [
    ...new Set(
      sheet.rows
        .filter((r) => r.imported)
        .map((r) => normalizeContainerNumber(r.containerNumber))
        .filter(Boolean)
    ),
  ]
  return { importedContainers, importedTotal: importedContainers.length }
}

export async function classifyImportedContainersForBackfill(
  containerNumbers: string[]
): Promise<{ needSourceLookup: string[]; needImportDraft: string[] }> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  if (unique.length === 0) {
    return { needSourceLookup: [], needImportDraft: [] }
  }

  const rows = await prisma.mail_container_forecast.findMany({
    where: { container_number: { in: unique } },
    select: {
      container_number: true,
      status: true,
      message_id: true,
      attachment_id: true,
      import_draft_data: true,
    },
  })
  const map = new Map(rows.map((r) => [r.container_number, r]))

  const needSourceLookup = unique.filter((cn) => needsSourceForecastBackfill(map.get(cn)))
  const needImportDraft = unique.filter((cn) => needsImportDraftBackfill(map.get(cn)))

  return { needSourceLookup, needImportDraft }
}

/**
 * 一次性补齐「已导入」柜号的源预报与导入预报（本地脚本用，无时间预算限制）。
 */
export async function runImportedForecastBackfillJob(options?: {
  batchSize?: number
  concurrency?: number
  phase?: ImportedForecastBackfillPhase
  dryRun?: boolean
  onProgress?: (message: string) => void
}): Promise<ImportedForecastBackfillResult> {
  const batchSize = Math.max(1, options?.batchSize ?? IMPORTED_BACKFILL_DEFAULT_BATCH_SIZE)
  const concurrency = Math.max(1, options?.concurrency ?? IMPORTED_BACKFILL_DEFAULT_CONCURRENCY)
  const phase = options?.phase ?? 'all'
  const dryRun = options?.dryRun ?? false
  const log = options?.onProgress ?? (() => {})
  const startedAt = Date.now()

  const { importedContainers, importedTotal } = await listImportedContainersForBackfill()
  const { needSourceLookup, needImportDraft } =
    await classifyImportedContainersForBackfill(importedContainers)

  let sourceProcessed = 0
  let sourceFound = 0
  let sourceNotFound = 0
  let sourceErrors = 0
  let importProcessed = 0
  let importConverted = 0
  let importSkipped = 0
  let importFailed = 0

  const runSource = phase === 'all' || phase === 'source'
  const runImport = phase === 'all' || phase === 'import'

  if (runSource && needSourceLookup.length > 0) {
    log(`源预报：待补齐 ${needSourceLookup.length} 个柜号`)
    for (let i = 0; i < needSourceLookup.length; i += batchSize) {
      const batch = needSourceLookup.slice(i, i + batchSize)
      if (dryRun) {
        sourceProcessed += batch.length
        continue
      }

      const results = await findSourceForecastsBatch(batch, concurrency)
      for (const result of results) {
        try {
          await upsertSourceForecastLookupResult(result)
          if (result.status === 'found') sourceFound++
          else sourceNotFound++
        } catch (error) {
          console.error(`persist source forecast failed ${result.containerNumber}:`, error)
          sourceErrors++
        }
      }
      sourceProcessed += results.length
      log(
        `源预报进度 ${Math.min(i + batchSize, needSourceLookup.length)}/${needSourceLookup.length}（本批找到 ${results.filter((r) => r.status === 'found').length}）`
      )
    }
  }

  let importTargets = needImportDraft
  if (runImport) {
    if (runSource && !dryRun && sourceProcessed > 0) {
      const refreshed = await classifyImportedContainersForBackfill(importedContainers)
      importTargets = refreshed.needImportDraft
    }

    if (importTargets.length > 0) {
      log(`导入预报：待补齐 ${importTargets.length} 个柜号`)
      for (let i = 0; i < importTargets.length; i += batchSize) {
        const batch = importTargets.slice(i, i + batchSize)
        if (dryRun) {
          importProcessed += batch.length
          continue
        }

        for (const cn of batch) {
          const result = await convertImportDraftForContainer(cn)
          importProcessed++
          if (result.status === 'converted') importConverted++
          else if (result.status === 'skipped') importSkipped++
          else importFailed++
        }
        log(
          `导入预报进度 ${Math.min(i + batchSize, importTargets.length)}/${importTargets.length}`
        )
      }
    }
  }

  return {
    importedTotal,
    needSourceLookup: needSourceLookup.length,
    needImportDraft: importTargets.length,
    sourceProcessed,
    sourceFound,
    sourceNotFound,
    sourceErrors,
    importProcessed,
    importConverted,
    importSkipped,
    importFailed,
    durationMs: Date.now() - startedAt,
    dryRun,
  }
}
