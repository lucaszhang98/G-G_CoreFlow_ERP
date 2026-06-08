import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { getForecastAiStatus, isForecastAiEnabled } from '@/lib/mail-assistant/forecast-ai-config'
import { geminiGenerateContent } from '@/lib/mail-assistant/gemini-client'

/** 验证 Gemini API Key 是否可用 */
export async function POST() {
  const perm = await checkPermission(['admin'])
  if (perm.error) return perm.error

  if (!isForecastAiEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: '未配置 GEMINI_API_KEY，请在 .env.local 添加后重启 dev 服务',
        forecastAi: getForecastAiStatus(),
      },
      { status: 400 }
    )
  }

  const model = getForecastAiStatus().model!

  try {
    const { text } = await geminiGenerateContent({
      userPrompt: '回复 JSON：{"ok":true}',
      temperature: 0,
      jsonResponse: true,
    })

    const parsed = JSON.parse(text) as { ok?: boolean }
    if (!parsed.ok) throw new Error('Gemini 响应格式异常')

    return NextResponse.json({
      ok: true,
      message: `Gemini 连接正常（${model}）`,
      forecastAi: getForecastAiStatus(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Gemini 测试失败',
        forecastAi: getForecastAiStatus(),
      },
      { status: 502 }
    )
  }
}
