/**
 * 为 mail_container_forecast / mail_forecast_feedback 增加邮件标题字段。
 * 运行：npx tsx scripts/migrate-mail-source-email-subject.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_container_forecast
      ADD COLUMN IF NOT EXISTS source_email_subject TEXT
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_forecast_feedback
      ADD COLUMN IF NOT EXISTS correct_email_subject TEXT
  `)
  console.log('source_email_subject / correct_email_subject columns ready')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
