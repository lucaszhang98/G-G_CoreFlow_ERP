/**
 * 将应收「到期日」统一为：关联发票开票日期的次月同日（与系统规则一致）。
 *
 * 用法：
 *   npx tsx scripts/backfill-receivable-due-one-month-after-invoice.ts --dry-run
 *   npx tsx scripts/backfill-receivable-due-one-month-after-invoice.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { dueDateOneMonthAfterInvoiceDate } from '../lib/finance/invoice-receivable-sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rows = await prisma.receivables.findMany({
    select: {
      receivable_id: true,
      invoice_id: true,
      due_date: true,
    },
  })

  let changed = 0
  for (const r of rows) {
    const inv = await prisma.invoices.findUnique({
      where: { invoice_id: r.invoice_id },
      select: { invoice_date: true },
    })
    if (!inv?.invoice_date) continue
    const nextDue = dueDateOneMonthAfterInvoiceDate(inv.invoice_date)
    const prevStr =
      r.due_date != null ? new Date(r.due_date).toISOString().slice(0, 10) : ''
    const nextStr = nextDue.toISOString().slice(0, 10)
    if (prevStr === nextStr) continue
    if (dryRun) {
      changed++
      continue
    }
    await prisma.receivables.update({
      where: { receivable_id: r.receivable_id },
      data: { due_date: nextDue, updated_at: new Date() },
    })
    changed++
  }

  console.log(
    dryRun
      ? `[dry-run] 将更新 ${changed} 条应收的到期日（未写库）`
      : `已更新 ${changed} 条应收的到期日`
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
