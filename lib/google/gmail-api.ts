import { getGmailClient } from '@/lib/google/workspace-oauth'

export async function testGmailAccess() {
  const gmail = await getGmailClient()
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const messages = await gmail.users.messages.list({ userId: 'me', maxResults: 1 })

  return {
    ok: true as const,
    message: `Gmail 连接成功，收件箱约 ${profile.data.messagesTotal ?? 0} 封邮件`,
    email: profile.data.emailAddress ?? null,
    hasMessages: (messages.data.messages?.length ?? 0) > 0,
  }
}
