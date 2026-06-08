import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { WorkspaceCredentials } from '@/lib/google/workspace-credentials'

const GMAIL_IMAP_HOST = 'imap.gmail.com'
const GMAIL_IMAP_PORT = 993

export async function testImapConnection(credentials: WorkspaceCredentials): Promise<{
  ok: boolean
  message: string
}> {
  const client = createImapClient(credentials)
  try {
    await client.connect()
    const mailbox = await client.mailboxOpen('INBOX')
    await client.logout()
    return {
      ok: true,
      message: `IMAP 连接成功，收件箱共 ${mailbox.exists ?? 0} 封邮件`,
    }
  } catch (error) {
    return {
      ok: false,
      message: formatImapError(error),
    }
  } finally {
    try {
      await client.close()
    } catch {
      // ignore
    }
  }
}

export async function searchGmailByQuery(
  credentials: WorkspaceCredentials,
  query: string,
  limit = 10
) {
  const client = createImapClient(credentials)
  const results: Array<{
    uid: number
    subject: string
    from: string
    date: string | null
    attachments: Array<{ filename: string; size: number }>
  }> = []

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    const uids = await client.search({ header: { subject: query } }, { uid: true })
    const uidList = Array.isArray(uids) ? uids.slice(-limit) : []

    for (const uid of uidList) {
      const message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true })
      if (!message?.source) continue

      const parsed = await simpleParser(message.source)
      const attachments = (parsed.attachments ?? []).map((att) => ({
        filename: att.filename || 'attachment',
        size: att.size ?? 0,
      }))

      results.push({
        uid,
        subject: parsed.subject || message.envelope?.subject || '',
        from: parsed.from?.text || '',
        date: parsed.date ? parsed.date.toISOString() : null,
        attachments,
      })
    }

    return results
  } finally {
    try {
      await client.logout()
      await client.close()
    } catch {
      // ignore
    }
  }
}

function createImapClient(credentials: WorkspaceCredentials) {
  return new ImapFlow({
    host: GMAIL_IMAP_HOST,
    port: GMAIL_IMAP_PORT,
    secure: true,
    auth: {
      user: credentials.email,
      pass: credentials.password,
    },
    logger: false,
  })
}

function formatImapError(error: unknown): string {
  const err = error as { message?: string; responseText?: string; authenticationFailed?: boolean }
  const message = err?.message || String(error)
  const responseText = err?.responseText || ''
  if (
    err?.authenticationFailed ||
    message.includes('AUTHENTICATIONFAILED') ||
    responseText.includes('Invalid credentials')
  ) {
    return 'IMAP 登录失败：Google 拒绝了账号密码。请确认密码正确，并在 Google 账号 → 安全性 中开启 IMAP；若有两步验证，请生成「应用专用密码」填入 GOOGLE_WORKSPACE_PASSWORD（不能用普通登录密码）。'
  }
  if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
    return '无法连接 Gmail IMAP 服务器，请检查网络。'
  }
  return `IMAP 连接失败：${message}`
}
