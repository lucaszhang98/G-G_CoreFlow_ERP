import { NextResponse } from 'next/server'
import { checkMailAssistantPermission } from '@/lib/mail-assistant/mail-assistant-permissions'
import { generateEmptyOrderImportDraftBuffer } from '@/lib/mail-assistant/generate-order-import-draft'

/** 与订单管理批量导入相同的空白模板（无需 Google 连接） */
export async function GET() {
  const perm = await checkMailAssistantPermission()
  if (perm.error) return perm.error

  try {
    const buffer = await generateEmptyOrderImportDraftBuffer()
    const filename = '订单导入模板.xlsx'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('forecast-import-template error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成导入模板失败' },
      { status: 500 }
    )
  }
}
