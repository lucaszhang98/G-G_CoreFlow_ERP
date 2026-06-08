import type { gmail_v1 } from 'googleapis'
import { getGmailClient } from '@/lib/google/workspace-oauth'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'

export type GmailExcelAttachment = {
  messageId: string
  threadId: string
  subject: string
  from: string
  date: string | null
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

function isExcelAttachment(filename: string, mimeType?: string | null): boolean {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return true
  const mime = (mimeType ?? '').toLowerCase()
  return mime.includes('spreadsheet') || mime.includes('excel')
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return found?.value ?? ''
}

function collectAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
  acc: Array<{ attachmentId: string; filename: string; mimeType: string; size: number }> = []
) {
  if (!payload) return acc
  if (payload.filename && payload.body?.attachmentId) {
    acc.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType ?? '',
      size: payload.body.size ?? 0,
    })
  }
  for (const part of payload.parts ?? []) {
    collectAttachments(part, acc)
  }
  return acc
}

export async function searchGmailExcelAttachmentsForContainer(
  containerNumber: string,
  maxMessages = 25
): Promise<GmailExcelAttachment[]> {
  const gmail = await getGmailClient()
  const normalized = normalizeContainerNumber(containerNumber)
  const q = `"${normalized}"`

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: maxMessages,
  })

  const messageRefs = listRes.data.messages ?? []
  const results: GmailExcelAttachment[] = []

  for (const ref of messageRefs) {
    if (!ref.id) continue
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: ref.id,
      format: 'full',
    })

    const payload = full.data.payload
    const attachments = collectAttachments(payload)
    const internalDate = full.data.internalDate
    const dateIso = internalDate ? new Date(Number(internalDate)).toISOString() : null

    for (const att of attachments) {
      if (!isExcelAttachment(att.filename, att.mimeType)) continue
      results.push({
        messageId: ref.id,
        threadId: full.data.threadId ?? ref.id,
        subject: getHeader(payload?.headers, 'subject'),
        from: getHeader(payload?.headers, 'from'),
        date: dateIso,
        attachmentId: att.attachmentId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      })
    }
  }

  return results
}

export async function downloadGmailAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })
  const data = res.data.data
  if (!data) throw new Error('附件内容为空')
  return Buffer.from(data, 'base64')
}

export function buildGmailAttachmentDownloadPath(
  messageId: string,
  attachmentId: string,
  filename: string
): string {
  const params = new URLSearchParams({
    messageId,
    attachmentId,
    filename,
  })
  return `/api/google/workspace/gmail/attachment?${params.toString()}`
}

/**
 * 打开 Gmail 中某一封邮件（网页会话视图）。
 * - authuser：OAuth 绑定邮箱，避免落到浏览器默认 Google 账号
 * - threadId 优先：Gmail 网页地址栏通常用会话 ID，仅用 messageId 可能只打开收件箱首页
 * - #all/：比 #inbox/ 更稳（邮件不在收件箱标签时也能打开）
 */
export async function resolveGmailThreadId(messageId: string): Promise<string | null> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'minimal',
  })
  return res.data.threadId ?? null
}

export function buildGmailMessageWebUrl(
  messageId: string,
  authUserEmail?: string | null,
  threadId?: string | null
): string {
  const id = (threadId?.trim() || messageId.trim())
  const params = new URLSearchParams()
  if (authUserEmail?.trim()) {
    params.set('authuser', authUserEmail.trim())
  }
  const qs = params.toString()
  return `https://mail.google.com/mail/u/${qs ? `?${qs}` : ''}#all/${id}`
}
