/**
 * 定时任务：补查尚无源预报的柜号（每 12 小时由外部调度触发）
 * GET /api/cron/mail-forecast-refresh
 *
 * 为避免 Netlify 等平台的函数超时，采用小批量 + 时间预算：
 * - 单次请求在时间预算内循环处理多批（默认每批 8 个柜号）
 * - 若仍有待查柜号，通过 after() 自动链式触发下一批（无需调度器重复配置）
 */
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getGoogleWorkspaceConnectionStatus, getAppBaseUrl } from '@/lib/google/workspace-oauth'
import {
  FORECAST_LOOKUP_DEFAULT_BATCH_SIZE,
  FORECAST_LOOKUP_DEFAULT_TIME_BUDGET_MS,
  runForecastLookupJob,
} from '@/lib/mail-assistant/run-forecast-lookup-job'

export const maxDuration = 26

const MAX_AUTO_CHAIN_DEPTH = 200

export async function GET(request: NextRequest) {
  try {
    const enableCronEnv = process.env.ENABLE_CRON_ENV
    const currentEnv = process.env.CONTEXT || process.env.NODE_ENV || 'development'

    if (enableCronEnv && currentEnv !== enableCronEnv) {
      return NextResponse.json({
        skipped: true,
        message: `定时任务已跳过：当前环境 ${currentEnv} 不匹配 ${enableCronEnv}`,
      })
    }

    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const google = await getGoogleWorkspaceConnectionStatus()
    if (!google.connected) {
      return NextResponse.json({
        skipped: true,
        message: 'Google 未连接，跳过邮件预报补查',
      })
    }

    const params = request.nextUrl.searchParams
    const batchParam = params.get('batch') ?? params.get('max')
    const batchSize = batchParam ? parseInt(batchParam, 10) : FORECAST_LOOKUP_DEFAULT_BATCH_SIZE
    const timeBudgetParam = params.get('timeBudgetMs')
    const timeBudgetMs = timeBudgetParam
      ? parseInt(timeBudgetParam, 10)
      : FORECAST_LOOKUP_DEFAULT_TIME_BUDGET_MS
    const autoContinue = params.get('autoContinue') !== '0'
    const chainDepth = parseInt(params.get('chainDepth') ?? '0', 10)

    const result = await runForecastLookupJob({
      batchSize: Number.isFinite(batchSize) ? Math.min(Math.max(batchSize, 1), 30) : FORECAST_LOOKUP_DEFAULT_BATCH_SIZE,
      concurrency: 2,
      timeBudgetMs: Number.isFinite(timeBudgetMs)
        ? Math.min(Math.max(timeBudgetMs, 5_000), 25_000)
        : FORECAST_LOOKUP_DEFAULT_TIME_BUDGET_MS,
    })

    const shouldChain =
      autoContinue && result.hasMore && chainDepth < MAX_AUTO_CHAIN_DEPTH && Boolean(cronSecret)

    if (shouldChain) {
      const nextUrl = new URL('/api/cron/mail-forecast-refresh', getAppBaseUrl())
      nextUrl.searchParams.set('batch', String(result.batchSize))
      nextUrl.searchParams.set('chainDepth', String(chainDepth + 1))
      const chainUrl = nextUrl.toString()

      after(async () => {
        try {
          const res = await fetch(chainUrl, {
            headers: { Authorization: `Bearer ${cronSecret}` },
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.error(
              `mail-forecast-refresh chain failed depth=${chainDepth + 1} status=${res.status}`,
              text.slice(0, 500)
            )
          }
        } catch (error) {
          console.error(`mail-forecast-refresh chain error depth=${chainDepth + 1}:`, error)
        }
      })
    }

    return NextResponse.json({
      success: true,
      ...result,
      chained: shouldChain,
      chainDepth,
      message: result.hasMore
        ? `本批完成：处理 ${result.processed}（${result.batchesProcessed} 批），找到 ${result.found}，暂无 ${result.notFound}；剩余 ${result.remaining} 个待查${shouldChain ? '，已自动续跑下一批' : ''}`
        : `预报补查全部完成：处理 ${result.processed}，找到 ${result.found}，暂无 ${result.notFound}`,
    })
  } catch (error) {
    console.error('mail-forecast-refresh cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '预报补查失败' },
      { status: 500 }
    )
  }
}
