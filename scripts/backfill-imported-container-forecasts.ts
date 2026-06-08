/**
 * 一次性补齐邮件助手中「已导入」柜号的源预报与导入预报。
 *
 * 规则：
 * - 「已导入」= YG2025 清单与 ERP 订单匹配（柜号一致、订单日期 ±60 天）
 * - 源预报：无记录 / not_found / found 但缺 Gmail 附件信息 → 执行找预报并持久化
 * - 导入预报：已有源预报但无缓存或仅 1 行陈旧数据 → 转换并写入 import_draft_data
 *
 * 用法：
 *   npx tsx scripts/backfill-imported-container-forecasts.ts --dry-run
 *   npx tsx scripts/backfill-imported-container-forecasts.ts
 *   npx tsx scripts/backfill-imported-container-forecasts.ts --phase=source
 *   npx tsx scripts/backfill-imported-container-forecasts.ts --phase=import --batch-size=4
 *   npx tsx scripts/backfill-imported-container-forecasts.ts --rules-only   # 大批量建议：跳过 Gemini，仅用规则打分
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { getGoogleWorkspaceConnectionStatus } from '../lib/google/workspace-oauth'
import {
  runImportedForecastBackfillJob,
  type ImportedForecastBackfillPhase,
} from '../lib/mail-assistant/run-imported-forecast-backfill-job'
import prisma from '../lib/prisma'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const dryRun = process.argv.includes('--dry-run')
const rulesOnly = process.argv.includes('--rules-only')
const phase = (parseArg('phase') ?? 'all') as ImportedForecastBackfillPhase
const batchSize = parseInt(parseArg('batch-size') ?? '8', 10)
const concurrency = parseInt(parseArg('concurrency') ?? '2', 10)

if (!['all', 'source', 'import'].includes(phase)) {
  console.error('无效 --phase，可选：all | source | import')
  process.exit(1)
}

async function main() {
  if (rulesOnly) {
    delete process.env.GEMINI_API_KEY
  }

  const google = await getGoogleWorkspaceConnectionStatus()
  if (!google.connected) {
    console.error('Google Workspace 未连接，请先在系统中完成 Gmail 授权后再运行本脚本。')
    process.exit(1)
  }
  console.log(`Google 已连接：${google.email ?? '(未知邮箱)'}`)
  console.log(
    `模式：${dryRun ? 'dry-run（仅统计）' : '执行补齐'} | phase=${phase} | batch=${batchSize} | concurrency=${concurrency}${rulesOnly ? ' | rules-only' : ''}`
  )

  const result = await runImportedForecastBackfillJob({
    dryRun,
    phase,
    batchSize: Number.isFinite(batchSize) ? batchSize : 8,
    concurrency: Number.isFinite(concurrency) ? concurrency : 2,
    onProgress: (msg) => console.log(msg),
  })

  console.log('\n--- 补齐结果 ---')
  console.log(`已导入柜号总数：${result.importedTotal}`)
  console.log(`待补源预报：${result.needSourceLookup}（已处理 ${result.sourceProcessed}，找到 ${result.sourceFound}，暂无 ${result.sourceNotFound}，错误 ${result.sourceErrors}）`)
  console.log(`待补导入预报：${result.needImportDraft}（已处理 ${result.importProcessed}，成功 ${result.importConverted}，跳过 ${result.importSkipped}，失败 ${result.importFailed}）`)
  console.log(`耗时：${(result.durationMs / 1000).toFixed(1)}s`)

  if (result.importFailed > 0 || result.sourceErrors > 0) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
