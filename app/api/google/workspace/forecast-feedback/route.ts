import { NextRequest, NextResponse } from 'next/server'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { saveForecastFeedback } from '@/lib/mail-assistant/forecast-feedback-store'

const MAX_FILE_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  const userId = perm.user?.id ? BigInt(perm.user.id) : null

  try {
    const form = await request.formData()
    const containerNumber = String(form.get('containerNumber') ?? '').trim()
    const orderDateKey = String(form.get('orderDateKey') ?? '').trim() || null
    const issueType = String(form.get('issueType') ?? 'other').trim()
    const comment = String(form.get('comment') ?? '').trim() || null
    const wrongSourceMetaRaw = String(form.get('wrongSourceMeta') ?? '').trim()
    const file = form.get('correctFile')

    if (!containerNumber) {
      return NextResponse.json({ error: '缺少柜号' }, { status: 400 })
    }

    const allowed = ['wrong_file', 'not_found', 'other']
    if (!allowed.includes(issueType)) {
      return NextResponse.json({ error: '无效的问题类型' }, { status: 400 })
    }

    let wrongSourceMeta: Record<string, unknown> | null = null
    if (wrongSourceMetaRaw) {
      try {
        wrongSourceMeta = JSON.parse(wrongSourceMetaRaw) as Record<string, unknown>
      } catch {
        return NextResponse.json({ error: 'wrongSourceMeta 不是合法 JSON' }, { status: 400 })
      }
    }

    let correctFileBuffer: Buffer | null = null
    let correctFilename: string | null = null
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: '正确预报文件不能超过 8MB' }, { status: 400 })
      }
      correctFilename = file.name
      correctFileBuffer = Buffer.from(await file.arrayBuffer())
    }

    const row = await saveForecastFeedback({
      containerNumber,
      orderDateKey,
      issueType: issueType as 'wrong_file' | 'not_found' | 'other',
      comment,
      wrongSourceMeta,
      correctFilename,
      correctFileBuffer,
      createdBy: userId,
    })

    return NextResponse.json({
      ok: true,
      feedbackId: String(row.feedback_id),
      message: '反馈已记录，后续找预报将参考此类纠正',
    })
  } catch (error) {
    console.error('forecast-feedback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交反馈失败' },
      { status: 500 }
    )
  }
}
