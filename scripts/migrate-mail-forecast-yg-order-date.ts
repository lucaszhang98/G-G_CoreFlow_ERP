/**
 * mail_container_forecast 增加 yg_order_date_key（码头表订单日期，用于导入预报转换）
 * 运行：npx tsx scripts/migrate-mail-forecast-yg-order-date.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.mail_container_forecast
      ADD COLUMN IF NOT EXISTS yg_order_date_key VARCHAR(10)
  `)
  console.log('yg_order_date_key column ready')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
