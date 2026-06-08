import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { buildExcelPreviewForAi } from '@/lib/mail-assistant/forecast-excel-scorer'
import {
  buildImportDraftCorrectionPreview,
  type ImportDraftFieldChange,
} from '@/lib/mail-assistant/import-draft-diff'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export type SaveForecastFeedbackInput = {
  containerNumber: string
  orderDateKey?: string | null
  issueType: 'wrong_file' | 'not_found' | 'import_wrong' | 'auto_import_edit' | 'other'
  comment?: string | null
  wrongSourceMeta?: Record<string, unknown> | null
  correctFilename?: string | null
  correctFileBuffer?: Buffer | null
  createdBy?: bigint | null
}

/** 找预报 AI 参考的反馈类型（排除导入表自动纠正） */
const FIND_FORECAST_TRAINING_ISSUE_TYPES = ['wrong_file', 'not_found', 'import_wrong', 'other'] as const

export type LoadForecastCorrectionOptions = {
  containerNumber?: string
  candidateFilenames?: string[]
  limit?: number
}

export async function saveForecastFeedback(input: SaveForecastFeedbackInput) {
  const row = await prisma.mail_forecast_feedback.create({
    data: {
      container_number: normalizeContainerNumber(input.containerNumber),
      order_date_key: input.orderDateKey?.trim() || null,
      issue_type: input.issueType,
      comment: input.comment?.trim() || null,
      wrong_source_meta: input.wrongSourceMeta
        ? (input.wrongSourceMeta as Prisma.InputJsonValue)
        : undefined,
      correct_filename: input.correctFilename?.trim() || null,
      correct_file_data: input.correctFileBuffer
        ? (Uint8Array.from(input.correctFileBuffer) as Uint8Array<ArrayBuffer>)
        : undefined,
      use_in_training: true,
      created_by: input.createdBy ?? undefined,
    },
  })
  return row
}

export type ForecastCorrectionExample = {
  containerNumber: string
  issueType: string
  comment: string | null
  wrongFilename: string | null
  correctFilename: string | null
  correctPreview: string | null
  relevanceScore?: number
}

function normalizeFilename(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function filenameSimilarity(a: string, b: string): number {
  const na = normalizeFilename(a)
  const nb = normalizeFilename(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.75
  const aBase = na.replace(/\.(xlsx|xls)$/i, '')
  const bBase = nb.replace(/\.(xlsx|xls)$/i, '')
  if (aBase === bBase) return 0.9
  if (aBase.includes(bBase) || bBase.includes(aBase)) return 0.6
  return 0
}

function scoreFindForecastFeedback(
  row: {
    container_number: string
    issue_type: string
    wrong_source_meta: unknown
    correct_filename: string | null
    created_at: Date
  },
  options: LoadForecastCorrectionOptions
): number {
  let score = 0

  const ageDays = (Date.now() - row.created_at.getTime()) / 86400000
  score += Math.max(0, 6 - ageDays / 15)

  if (options.containerNumber) {
    if (normalizeContainerNumber(row.container_number) === normalizeContainerNumber(options.containerNumber)) {
      score += 10
    }
  }

  const wrongFilename =
    row.wrong_source_meta &&
    typeof row.wrong_source_meta === 'object' &&
    'filename' in row.wrong_source_meta
      ? String((row.wrong_source_meta as { filename?: string }).filename ?? '')
      : ''

  const candidates = options.candidateFilenames ?? []
  for (const candidate of candidates) {
    if (wrongFilename) {
      score += filenameSimilarity(wrongFilename, candidate) * 5
    }
    if (row.correct_filename) {
      score += filenameSimilarity(row.correct_filename, candidate) * 3
    }
  }

  if (row.issue_type === 'wrong_file') score += 3
  if (row.issue_type === 'not_found') score += 2
  if (row.issue_type === 'import_wrong') score += 1

  return score
}

/** 供找预报 Gemini 参考：按柜号/候选文件名相关性检索，而非仅取最近 N 条 */
export async function loadForecastCorrectionExamples(
  options: LoadForecastCorrectionOptions | number = {}
): Promise<ForecastCorrectionExample[]> {
  const resolved: LoadForecastCorrectionOptions =
    typeof options === 'number' ? { limit: options } : options
  const limit = Math.max(1, Math.min(resolved.limit ?? 8, 15))

  const rows = await prisma.mail_forecast_feedback.findMany({
    where: {
      use_in_training: true,
      issue_type: { in: [...FIND_FORECAST_TRAINING_ISSUE_TYPES] },
    },
    orderBy: { created_at: 'desc' },
    take: 80,
  })

  const ranked = rows
    .map((r) => ({
      row: r,
      score: scoreFindForecastFeedback(r, resolved),
    }))
    .sort((a, b) => b.score - a.score || b.row.created_at.getTime() - a.row.created_at.getTime())
    .slice(0, limit)

  return ranked.map(({ row: r, score }) => ({
    containerNumber: r.container_number,
    issueType: r.issue_type,
    comment: r.comment,
    wrongFilename:
      r.wrong_source_meta && typeof r.wrong_source_meta === 'object' && 'filename' in r.wrong_source_meta
        ? String((r.wrong_source_meta as { filename?: string }).filename ?? '')
        : null,
    correctFilename: r.correct_filename,
    correctPreview: r.correct_file_data
      ? buildExcelPreviewForAi(Buffer.from(r.correct_file_data), 6)
      : null,
    relevanceScore: Math.round(score * 10) / 10,
  }))
}

export type ImportDraftCorrectionExample = {
  containerNumber: string
  summary: string
  fieldChanges: Array<{ row: number; field: string; before: string; after: string }>
  sourceFilename: string | null
}

/** 供转换 AI 兜底参考：同事在导入预报页的自动纠正记录 */
export async function loadImportDraftCorrectionExamples(
  containerNumber?: string,
  limit = 6
): Promise<ImportDraftCorrectionExample[]> {
  const rows = await prisma.mail_forecast_feedback.findMany({
    where: {
      use_in_training: true,
      issue_type: 'auto_import_edit',
      ...(containerNumber
        ? { container_number: normalizeContainerNumber(containerNumber) }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    take: containerNumber ? limit : 40,
  })

  const picked = containerNumber
    ? rows.slice(0, limit)
    : dedupeByContainer(rows).slice(0, limit)

  return picked.map((r) => {
    const meta =
      r.wrong_source_meta && typeof r.wrong_source_meta === 'object'
        ? (r.wrong_source_meta as Record<string, unknown>)
        : {}
    const rawChanges = Array.isArray(meta.fieldChanges) ? meta.fieldChanges : []
    const fieldChanges = rawChanges
      .filter(
        (c): c is ImportDraftFieldChange =>
          typeof c === 'object' &&
          c !== null &&
          'field' in c &&
          'before' in c &&
          'after' in c
      )
      .map((c) => ({
        row: Number(c.row) || 0,
        field: String(c.field),
        before: String(c.before).slice(0, 80),
        after: String(c.after).slice(0, 80),
      }))

    return {
      containerNumber: r.container_number,
      summary: r.comment ?? '导入表自动纠正',
      fieldChanges,
      sourceFilename:
        typeof meta.sourceFilename === 'string' ? meta.sourceFilename : null,
    }
  })
}

function dedupeByContainer(
  rows: Array<{ container_number: string; created_at: Date }>
) {
  const seen = new Set<string>()
  const out: typeof rows = []
  for (const row of rows) {
    if (seen.has(row.container_number)) continue
    seen.add(row.container_number)
    out.push(row)
  }
  return out
}

/** 同事保存导入预报时：自动记录 baseline → 改后 差异，无需填反馈表 */
export async function recordAutoImportDraftCorrection(input: {
  containerNumber: string
  sourceFilename?: string | null
  fieldChanges: ImportDraftFieldChange[]
  summary: string
  beforeDetailRows: number
  afterDetailRows: number
  correctedFileBuffer: Buffer
  createdBy?: bigint | null
}): Promise<void> {
  const cn = normalizeContainerNumber(input.containerNumber)
  if (input.fieldChanges.length === 0 && input.beforeDetailRows === input.afterDetailRows) {
    return
  }

  await prisma.mail_forecast_feedback.deleteMany({
    where: { container_number: cn, issue_type: 'auto_import_edit' },
  })

  await prisma.mail_forecast_feedback.create({
    data: {
      container_number: cn,
      issue_type: 'auto_import_edit',
      comment: input.summary,
      wrong_source_meta: {
        sourceFilename: input.sourceFilename ?? null,
        fieldChanges: buildImportDraftCorrectionPreview(input.fieldChanges, 20),
        beforeDetailRows: input.beforeDetailRows,
        afterDetailRows: input.afterDetailRows,
        autoRecorded: true,
      },
      correct_filename: `导入预报_${cn}_已纠正.xlsx`,
      correct_file_data: Uint8Array.from(input.correctedFileBuffer) as Uint8Array<ArrayBuffer>,
      use_in_training: true,
      created_by: input.createdBy ?? undefined,
    },
  })
}
