/**
 * 一次性补救：清空所有收款核销明细，并将应收「已核销」归零，
 * 再按应收金额用 deriveReceivableBalanceAndStatus 重算 balance / status。
 *
 * 背景：历史上删除收款等操作未冲回应收，导致 allocated 与核销明细不一致；
 * 本脚本把应收侧与核销表拉回一致起点（收款主表仍保留，相当于未核销状态）。
 *
 * 用法：
 *   npx tsx scripts/remediate-zero-receivable-allocations.ts --dry-run   # 只打印统计，不写库
 *   npx tsx scripts/remediate-zero-receivable-allocations.ts            # 执行写库
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { deriveReceivableBalanceAndStatus } from '../lib/finance/invoice-receivable-sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const allocCount = await prisma.payment_allocations.count()
  const recvCount = await prisma.receivables.count()

  console.log(`当前 payment_allocations 行数: ${allocCount}`)
  console.log(`当前 receivables 行数: ${recvCount}`)

  if (dryRun) {
    console.log('[dry-run] 将删除全部核销行，并把每条应收 allocated_amount=0 后重算 balance/status。未写库。')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.payment_allocations.deleteMany({})
    console.log(`已删除 payment_allocations: ${deleted.count} 行`)

    const rows = await tx.receivables.findMany({
      select: {
        receivable_id: true,
        receivable_amount: true,
      },
    })

    let updated = 0
    for (const r of rows) {
      const { balance, status } = deriveReceivableBalanceAndStatus(
        r.receivable_amount,
        0
      )
      await tx.receivables.update({
        where: { receivable_id: r.receivable_id },
        data: {
          allocated_amount: 0,
          balance,
          status,
          updated_at: new Date(),
        },
      })
      updated++
      if (updated % 200 === 0) {
        console.log(`  已更新 receivables: ${updated}/${rows.length}`)
      }
    }
    console.log(`已更新 receivables: ${updated} 条（allocated=0，balance/status 已重算）`)
  })

  console.log('补救完成。')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
