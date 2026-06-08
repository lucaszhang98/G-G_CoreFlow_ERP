type GeminiGenerateOptions = {
  systemInstruction?: string
  userPrompt: string
  temperature?: number
  jsonResponse?: boolean
}

type GeminiGenerateResult = {
  text: string
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('未配置 GEMINI_API_KEY')
  return key
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
}

export async function geminiGenerateContent(
  options: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const apiKey = getGeminiApiKey()
  const model = getGeminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      ...(options.jsonResponse ? { responseMimeType: 'application/json' } : {}),
    },
  }

  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
    error?: { message?: string }
  }

  if (data.error?.message) {
    throw new Error(data.error.message)
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
  if (!text) throw new Error('Gemini 空响应')

  return { text }
}
