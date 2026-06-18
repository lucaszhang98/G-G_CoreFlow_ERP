/**
 * 清理无有效导入预报却带有 import_draft_download_url 的旧数据（迁移脚本误写入）。
 * 运行：npx tsx scripts/normalize-import-draft-download-urls.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import prisma from '../lib/prisma'
import {
  loadPersistedForecasts,
  resolveImportDraftDisplayState,
} from '../lib/mail-assistant/forecast-persistence'

async function main() {
  const rows = await prisma.mail_container_forecast.findMany({
    where: { status: 'found', import_draft_download_url: { not: null } },
    select: {
      container_number: true,
      import_draft_download_url: true,
      import_draft_data: true,
      import_draft_baseline_data: true,
      import_draft_warnings: true,
    },
  })

  const toClear = rows.filter((row) => !resolveImportDraftDisplayState(row).hasImportDraft)
  if (toClear.length === 0) {
    console.log('无需清理的导入预报链接')
    return
  }

  await Promise.all(
    toClear.map((row) =>
      prisma.mail_container_forecast.update({
        where: { container_number: row.container_number },
        data: { import_draft_download_url: null, updated_at: new Date() },
      })
    )
  )

  console.log(`已清理 ${toClear.length} 条无效 import_draft_download_url`)

  // 触发与页面一致的 DTO 解析（含懒清理逻辑）
  await loadPersistedForecasts(toClear.map((r) => r.container_number))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
