/**
 * 为 mail_container_forecast 增加 import_draft_baseline_data，用于导入表自动学习。
 * 运行：npx tsx scripts/migrate-mail-import-draft-baseline.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_container_forecast
      ADD COLUMN IF NOT EXISTS import_draft_baseline_data BYTEA
  `)

  const updated = await prisma.$executeRawUnsafe(`
    UPDATE public.mail_container_forecast
    SET import_draft_baseline_data = import_draft_data
    WHERE import_draft_baseline_data IS NULL
      AND import_draft_data IS NOT NULL
  `)

  console.log(`import_draft_baseline_data column ready; backfilled rows: ${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
