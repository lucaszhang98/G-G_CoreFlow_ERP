import { buildExcelPreviewForAi } from '@/lib/mail-assistant/forecast-excel-scorer'
import {
  getOrderForecastTemplateHint,
  isForecastAiEnabled,
} from '@/lib/mail-assistant/forecast-ai-config'
import { loadForecastCorrectionExamples } from '@/lib/mail-assistant/forecast-feedback-store'
import { geminiGenerateContent } from '@/lib/mail-assistant/gemini-client'

export type ForecastAiCandidate = {
  index: number
  filename: string
  emailSubject: string
  emailFrom: string
  score: number
  matchedHeaders: string[]
  templateKind: string
  containerFound: boolean
  scoreReasons: string[]
  preview: string
}

export type ForecastAiResolveResult = {
  choiceIndex: number
  reason: string
  usedAi: boolean
}

function fallbackByScore(candidates: ForecastAiCandidate[]): ForecastAiResolveResult {
  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (!top || top.score < 30 || !top.containerFound) {
    return { choiceIndex: -1, reason: '规则未命中可用预报', usedAi: false }
  }
  return {
    choiceIndex: top.index,
    reason: '未配置 AI，采用规则最高分',
    usedAi: false,
  }
}

/**
 * AI 优先裁决源预报（Gemini）。未配置 GEMINI_API_KEY 时回退规则最高分。
 */
export async function resolveForecastWithAi(
  containerNumber: string,
  candidates: ForecastAiCandidate[],
  buffers: Map<number, Buffer>
): Promise<ForecastAiResolveResult> {
  if (candidates.length === 0) {
    return { choiceIndex: -1, reason: '无 Excel 候选', usedAi: false }
  }

  if (!isForecastAiEnabled()) {
    return fallbackByScore(candidates)
  }

  const templateHint = getOrderForecastTemplateHint()
  const correctionExamples = await loadForecastCorrectionExamples({
    containerNumber,
    candidateFilenames: candidates.map((c) => c.filename),
    limit: 8,
  })

  const enriched = candidates.map((c) => ({
    index: c.index,
    filename: c.filename,
    emailSubject: c.emailSubject,
    emailFrom: c.emailFrom,
    ruleScore: c.score,
    containerFoundInSheet: c.containerFound,
    matchedHeaders: c.matchedHeaders,
    templateKind: c.templateKind,
    ruleReasons: c.scoreReasons,
    preview: c.preview || buildExcelPreviewForAi(buffers.get(c.index) ?? Buffer.alloc(0), 8),
  }))

  const prompt = `目标柜号：${containerNumber}

## 任务
从下列 Gmail Excel 附件中，选出**唯一一份**适合作为该柜「源预报」的文件。

## 源预报定义（用于后续订单导入）
- 结构接近公司订单导入模板，核心字段包括：${templateHint}
- 「订单号」列通常就是柜号（4字母+7数字）
- 同一份 Excel 可含多个柜号（同批预报），只要表内包含 ${containerNumber} 即可
- **不是**源预报：提柜作业表（码头/LFD/提柜日期为主）、账单、工资、内部统计、与柜号无关的文件

## 人工纠正样例（按相关性排序，请避免重复同类错误）
${correctionExamples.length ? JSON.stringify(correctionExamples, null, 2) : '（暂无）'}

## 候选附件
${JSON.stringify(enriched, null, 2)}

## 输出要求
只返回 JSON，不要其它文字：
- 找到：{"choiceIndex":<候选index>,"reason":"<一句话中文，说明为何选这份>"}
- 都没有：{"choiceIndex":-1,"reason":"<一句话中文>"}

choiceIndex 必须是上面候选中的 index 字段，或 -1。`

  try {
    const { text: content } = await geminiGenerateContent({
      systemInstruction:
        '你是 G&G 物流 ERP 的源预报识别助手。只输出合法 JSON。不确定时宁可 choiceIndex=-1，不要瞎选。',
      userPrompt: prompt,
      temperature: 0.1,
      jsonResponse: true,
    })

    const parsed = JSON.parse(content) as { choiceIndex?: number; reason?: string }
    const choiceIndex = Number(parsed.choiceIndex)

    if (choiceIndex === -1) {
      return {
        choiceIndex: -1,
        reason: parsed.reason || 'AI 判定暂无源预报',
        usedAi: true,
      }
    }

    const valid = candidates.some((c) => c.index === choiceIndex)
    if (!valid) throw new Error(`AI 返回无效 choiceIndex: ${choiceIndex}`)

    return {
      choiceIndex,
      reason: parsed.reason || 'AI 选定',
      usedAi: true,
    }
  } catch (error) {
    console.error('forecast AI resolve failed:', error)
    const fb = fallbackByScore(candidates)
    return {
      ...fb,
      reason: `AI 调用失败（${error instanceof Error ? error.message : 'unknown'}），${fb.reason}`,
    }
  }
}
