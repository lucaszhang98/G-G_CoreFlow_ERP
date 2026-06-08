import prisma from '@/lib/prisma'
import { buildExcelPreviewForAi } from '@/lib/mail-assistant/forecast-excel-scorer'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export type SaveForecastFeedbackInput = {
  containerNumber: string
  orderDateKey?: string | null
  issueType: 'wrong_file' | 'not_found' | 'import_wrong' | 'other'
  comment?: string | null
  wrongSourceMeta?: Record<string, unknown> | null
  correctFilename?: string | null
  correctFileBuffer?: Buffer | null
  createdBy?: bigint | null
}

export async function saveForecastFeedback(input: SaveForecastFeedbackInput) {
  const row = await prisma.mail_forecast_feedback.create({
    data: {
      container_number: normalizeContainerNumber(input.containerNumber),
      order_date_key: input.orderDateKey?.trim() || null,
      issue_type: input.issueType,
      comment: input.comment?.trim() || null,
      wrong_source_meta: input.wrongSourceMeta ?? undefined,
      correct_filename: input.correctFilename?.trim() || null,
      correct_file_data: input.correctFileBuffer ?? undefined,
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
}

/** 供 Gemini 参考的最近人工纠正样例 */
export async function loadForecastCorrectionExamples(limit = 5): Promise<ForecastCorrectionExample[]> {
  const rows = await prisma.mail_forecast_feedback.findMany({
    where: { use_in_training: true },
    orderBy: { created_at: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
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
  }))
}
