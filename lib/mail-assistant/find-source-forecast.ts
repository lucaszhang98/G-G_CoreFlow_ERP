import {
  buildGmailAttachmentDownloadPath,
  buildGmailMessageWebUrl,
  downloadGmailAttachment,
  searchGmailExcelAttachmentsForContainer,
} from '@/lib/google/gmail-forecast'
import { isForecastAiEnabled } from '@/lib/mail-assistant/forecast-ai-config'
import {
  type ForecastAiCandidate,
  resolveForecastWithAi,
} from '@/lib/mail-assistant/forecast-ai-resolve'
import { scoreForecastExcel } from '@/lib/mail-assistant/forecast-excel-scorer'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import { getGoogleWorkspaceConnectionStatus } from '@/lib/google/workspace-oauth'

export type SourceForecastLink = {
  label: string
  downloadUrl: string
  gmailUrl: string
  filename: string
  messageId: string
  threadId: string
  attachmentId: string
  score: number
  aiResolved: boolean
  resolveReason: string
}

export type SourceForecastLookupResult = {
  containerNumber: string
  status: 'found' | 'not_found'
  sourceForecast: SourceForecastLink | null
  candidateCount: number
  excelAttachmentCount: number
  aiMode: 'ai_first' | 'rules_only'
  /** 未找到时的 AI/规则说明 */
  resolveReason?: string
}

type ScoredCandidate = {
  index: number
  attachment: Awaited<ReturnType<typeof searchGmailExcelAttachmentsForContainer>>[number]
  score: ReturnType<typeof scoreForecastExcel>
  buffer: Buffer
}

const AI_CANDIDATE_LIMIT = 8

export async function findSourceForecastForContainer(
  containerNumber: string
): Promise<SourceForecastLookupResult> {
  const normalized = normalizeContainerNumber(containerNumber)
  const aiMode = isForecastAiEnabled() ? 'ai_first' : 'rules_only'
  const { email: workspaceEmail } = await getGoogleWorkspaceConnectionStatus()
  const attachments = await searchGmailExcelAttachmentsForContainer(normalized)

  if (attachments.length === 0) {
    return emptyResult(normalized, 0, 0, aiMode)
  }

  const scored: ScoredCandidate[] = []
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]
    try {
      const buffer = await downloadGmailAttachment(att.messageId, att.attachmentId)
      const score = scoreForecastExcel({
        buffer,
        filename: att.filename,
        containerNumber: normalized,
        emailSubject: att.subject,
      })
      scored.push({ index: i, attachment: att, score, buffer })
    } catch (error) {
      console.warn(`skip attachment ${att.filename}:`, error)
    }
  }

  if (scored.length === 0) {
    return emptyResult(normalized, 0, attachments.length, aiMode)
  }

  scored.sort((a, b) => b.score.score - a.score.score)

  if (aiMode === 'ai_first') {
    return await resolveWithAiFirst(
      normalized,
      scored,
      attachments.length,
      aiMode,
      workspaceEmail
    )
  }

  return resolveWithRulesOnly(normalized, scored, attachments.length, aiMode, workspaceEmail)
}

async function resolveWithAiFirst(
  containerNumber: string,
  scored: ScoredCandidate[],
  excelAttachmentCount: number,
  aiMode: 'ai_first' | 'rules_only',
  workspaceEmail: string | null
): Promise<SourceForecastLookupResult> {
  const pool = scored.slice(0, AI_CANDIDATE_LIMIT)
  const aiCandidates: ForecastAiCandidate[] = pool.map((s) => ({
    index: s.index,
    filename: s.attachment.filename,
    emailSubject: s.attachment.subject,
    emailFrom: s.attachment.from,
    score: s.score.score,
    matchedHeaders: s.score.matchedHeaders,
    templateKind: s.score.templateKind,
    containerFound: s.score.containerFound,
    scoreReasons: s.score.reasons,
    preview: '',
  }))

  const bufferMap = new Map<number, Buffer>()
  for (const s of pool) {
    bufferMap.set(s.index, s.buffer)
  }

  return await pickFromAiResult(
    containerNumber,
    scored,
    aiCandidates,
    bufferMap,
    scored.length,
    excelAttachmentCount,
    aiMode,
    workspaceEmail
  )
}

async function pickFromAiResult(
  containerNumber: string,
  scored: ScoredCandidate[],
  aiCandidates: ForecastAiCandidate[],
  bufferMap: Map<number, Buffer>,
  candidateCount: number,
  excelAttachmentCount: number,
  aiMode: 'ai_first' | 'rules_only',
  workspaceEmail: string | null
): Promise<SourceForecastLookupResult> {
  const ai = await resolveForecastWithAi(containerNumber, aiCandidates, bufferMap)

  if (ai.choiceIndex === -1) {
    return {
      containerNumber,
      status: 'not_found',
      sourceForecast: null,
      candidateCount,
      excelAttachmentCount,
      aiMode,
      resolveReason: ai.reason,
    }
  }

  const picked = scored.find((s) => s.index === ai.choiceIndex)
  if (!picked) {
    return emptyResult(containerNumber, candidateCount, excelAttachmentCount, aiMode)
  }

  return buildResult(
    containerNumber,
    picked,
    candidateCount,
    excelAttachmentCount,
    ai.usedAi,
    ai.reason,
    aiMode,
    workspaceEmail
  )
}

function resolveWithRulesOnly(
  containerNumber: string,
  scored: ScoredCandidate[],
  excelAttachmentCount: number,
  aiMode: 'ai_first' | 'rules_only',
  workspaceEmail: string | null
): SourceForecastLookupResult {
  const withContainer = scored.filter((s) => s.score.containerFound)
  if (withContainer.length === 0) {
    return emptyResult(containerNumber, scored.length, excelAttachmentCount, aiMode)
  }

  const top = withContainer[0]
  return buildResult(
    containerNumber,
    top,
    scored.length,
    excelAttachmentCount,
    false,
    '规则模式：表内含柜号且分数最高',
    aiMode,
    workspaceEmail
  )
}

function emptyResult(
  containerNumber: string,
  candidateCount: number,
  excelAttachmentCount: number,
  aiMode: 'ai_first' | 'rules_only'
): SourceForecastLookupResult {
  return {
    containerNumber,
    status: 'not_found',
    sourceForecast: null,
    candidateCount,
    excelAttachmentCount,
    aiMode,
  }
}

function buildResult(
  containerNumber: string,
  picked: ScoredCandidate,
  candidateCount: number,
  excelAttachmentCount: number,
  aiResolved: boolean,
  resolveReason: string,
  aiMode: 'ai_first' | 'rules_only',
  workspaceEmail: string | null
): SourceForecastLookupResult {
  const att = picked.attachment
  const downloadUrl = buildGmailAttachmentDownloadPath(att.messageId, att.attachmentId, att.filename)

  return {
    containerNumber,
    status: 'found',
    sourceForecast: {
      label: att.filename,
      downloadUrl,
      gmailUrl: buildGmailMessageWebUrl(att.messageId, workspaceEmail, att.threadId),
      filename: att.filename,
      messageId: att.messageId,
      threadId: att.threadId,
      attachmentId: att.attachmentId,
      score: picked.score.score,
      aiResolved,
      resolveReason,
    },
    candidateCount,
    excelAttachmentCount,
    aiMode,
  }
}

/** 批量查找；AI 模式降低并发，减轻限流 */
export async function findSourceForecastsBatch(
  containerNumbers: string[],
  concurrency?: number
): Promise<SourceForecastLookupResult[]> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  const results: SourceForecastLookupResult[] = []
  let cursor = 0
  const parallel = concurrency ?? (isForecastAiEnabled() ? 2 : 3)

  async function worker() {
    while (cursor < unique.length) {
      const idx = cursor++
      const cn = unique[idx]
      try {
        results[idx] = await findSourceForecastForContainer(cn)
      } catch (error) {
        console.error(`forecast lookup failed for ${cn}:`, error)
        results[idx] = emptyResult(
          cn,
          0,
          0,
          isForecastAiEnabled() ? 'ai_first' : 'rules_only'
        )
      }
    }
  }

  const workers = Array.from({ length: Math.min(parallel, unique.length) }, () => worker())
  await Promise.all(workers)
  return results
}
