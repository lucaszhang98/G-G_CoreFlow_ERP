/**
 * 扩容 mail_container_forecast 字段，并新增超链接持久化列。
 * 运行：npx tsx scripts/migrate-mail-container-forecast-urls.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import {
  buildGmailAttachmentDownloadPath,
  buildGmailMessageWebUrl,
} from '../lib/google/gmail-forecast'
import { buildImportDraftDownloadUrl } from '../lib/mail-assistant/forecast-persistence'
import { getGoogleWorkspaceConnectionStatus } from '../lib/google/workspace-oauth'
import prisma from '../lib/prisma'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_container_forecast
      ALTER COLUMN container_number TYPE VARCHAR(32),
      ALTER COLUMN status TYPE VARCHAR(32),
      ALTER COLUMN source_filename TYPE TEXT,
      ALTER COLUMN message_id TYPE TEXT,
      ALTER COLUMN attachment_id TYPE TEXT,
      ALTER COLUMN resolve_reason TYPE TEXT,
      ALTER COLUMN import_draft_warnings TYPE TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_container_forecast
      ADD COLUMN IF NOT EXISTS source_download_url TEXT,
      ADD COLUMN IF NOT EXISTS gmail_url TEXT,
      ADD COLUMN IF NOT EXISTS import_draft_download_url TEXT,
      ADD COLUMN IF NOT EXISTS thread_id TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_forecast_feedback
      ALTER COLUMN correct_filename TYPE TEXT
  `)

  const { email: workspaceEmail } = await getGoogleWorkspaceConnectionStatus()

  const rows = await prisma.mail_container_forecast.findMany({
    where: { status: 'found' },
  })

  for (const row of rows) {
    if (!row.message_id || !row.attachment_id) continue
    const threadId = (row as { thread_id?: string | null }).thread_id ?? null
    await prisma.mail_container_forecast.update({
      where: { container_number: row.container_number },
      data: {
        source_download_url:
          row.source_download_url ??
          buildGmailAttachmentDownloadPath(
            row.message_id,
            row.attachment_id,
            row.source_filename ?? 'source.xlsx'
          ),
        gmail_url: buildGmailMessageWebUrl(row.message_id, workspaceEmail, threadId),
        import_draft_download_url:
          row.import_draft_download_url ?? buildImportDraftDownloadUrl(row.container_number),
      },
    })
  }

  console.log(`mail_container_forecast migrated; backfilled ${rows.length} row(s)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
