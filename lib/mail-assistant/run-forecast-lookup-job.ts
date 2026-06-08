import { fetchYg2025ImportCheck } from '@/lib/google/oak-yg2025-sheet'
import { findSourceForecastsBatch } from '@/lib/mail-assistant/find-source-forecast'
import {
  listContainersDueForLookup,
  upsertSourceForecastLookupResult,
} from '@/lib/mail-assistant/forecast-persistence'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export const FORECAST_LOOKUP_DEFAULT_BATCH_SIZE = 8
export const FORECAST_LOOKUP_DEFAULT_TIME_BUDGET_MS = 22_000

export type ForecastLookupJobResult = {
  totalSheetContainers: number
  dueCount: number
  processed: number
  found: number
  notFound: number
  errors: number
  batchesProcessed: number
  batchSize: number
  hasMore: boolean
  remaining: number
  durationMs: number
}

/**
 * 对「尚无源预报」或 not_found 且超过 12 小时的柜号批量找预报并持久化。
 * 在单次请求的时间预算内循环处理多批；每批处理完会刷新待查列表，避免重复扫已处理柜号。
 */
export async function runForecastLookupJob(options?: {
  batchSize?: number
  concurrency?: number
  timeBudgetMs?: number
}): Promise<ForecastLookupJobResult> {
  const batchSize = Math.max(1, options?.batchSize ?? FORECAST_LOOKUP_DEFAULT_BATCH_SIZE)
  const concurrency = options?.concurrency ?? 2
  const timeBudgetMs = Math.max(5_000, options?.timeBudgetMs ?? FORECAST_LOOKUP_DEFAULT_TIME_BUDGET_MS)
  const startedAt = Date.now()

  const sheet = await fetchYg2025ImportCheck()
  const allContainers = [
    ...new Set(sheet.rows.map((r) => normalizeContainerNumber(r.containerNumber)).filter(Boolean)),
  ]

  let found = 0
  let notFound = 0
  let errors = 0
  let processed = 0
  let batchesProcessed = 0

  const initialDue = await listContainersDueForLookup(allContainers)

  while (Date.now() - startedAt < timeBudgetMs) {
    const due = await listContainersDueForLookup(allContainers)
    const batch = due.slice(0, batchSize)
    if (batch.length === 0) break

    const results = await findSourceForecastsBatch(batch, concurrency)

    for (const result of results) {
      try {
        await upsertSourceForecastLookupResult(result)
        if (result.status === 'found') found++
        else notFound++
      } catch (error) {
        console.error(`persist forecast failed ${result.containerNumber}:`, error)
        errors++
      }
    }

    processed += results.length
    batchesProcessed++

    if (batch.length < batchSize) break
  }

  const remaining = (await listContainersDueForLookup(allContainers)).length

  return {
    totalSheetContainers: allContainers.length,
    dueCount: initialDue.length,
    processed,
    found,
    notFound,
    errors,
    batchesProcessed,
    batchSize,
    hasMore: remaining > 0,
    remaining,
    durationMs: Date.now() - startedAt,
  }
}
