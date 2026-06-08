import { ORDER_FORECAST_CANONICAL_HEADERS } from '@/lib/mail-assistant/forecast-template-profile'
import { getGeminiModel } from '@/lib/mail-assistant/gemini-client'

/** 找预报：配置 GEMINI_API_KEY 后启用 AI 优先模式 */
export function isForecastAiEnabled(): boolean {
  if (process.env.FORECAST_USE_AI === 'false') return false
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

export function getForecastAiModel(): string {
  return getGeminiModel()
}

export function getForecastAiStatus() {
  const configured = isForecastAiEnabled()
  return {
    configured,
    provider: configured ? ('gemini' as const) : null,
    model: configured ? getForecastAiModel() : null,
    mode: configured ? ('ai_first' as const) : ('rules_only' as const),
  }
}

export function getOrderForecastTemplateHint(): string {
  return ORDER_FORECAST_CANONICAL_HEADERS.join('、')
}
