/**
 * 对有提柜日、未填拆柜人员的柜子，按公式重算拆柜日并写回。
 * 用法：npx tsx scripts/recalc-planned-unload-with-pickup.ts
 */

import './load-project-env'
import prisma from '../lib/prisma'
import { runRecalcPlannedUnloadForOrdersWithPickup } from '../lib/wms/run-fix-planned-unload-dates'

async function main() {
  console.log('开始重算有提柜日且无拆柜人员的拆柜日期...\n')
  const result = await runRecalcPlannedUnloadForOrdersWithPickup()
  console.log(result.message)
  console.log('\n变更明细（最多 100 条）:')
  for (const c of result.changes) {
    console.log(`  ${c.order_number}: ${c.from ?? '空'} → ${c.to}`)
  }
  if (result.errors.length > 0) {
    console.log('\n失败:')
    for (const e of result.errors.slice(0, 30)) {
      console.log(`  ${e.order_number}: ${e.error}`)
    }
  }
  console.log('\n汇总:', {
    total_candidates: result.total_candidates,
    updated: result.updated,
    unchanged: result.unchanged,
    skipped_inspection: result.skipped_inspection,
    failed: result.failed,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
