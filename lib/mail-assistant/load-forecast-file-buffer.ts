import { downloadGmailAttachment } from '@/lib/google/gmail-forecast'
import { getImportDraftBuffer } from '@/lib/mail-assistant/forecast-persistence'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import prisma from '@/lib/prisma'

export async function loadForecastFileBuffer(
  kind: 'source' | 'import',
  containerNumber: string
): Promise<{ buffer: Buffer; filename: string }> {
  const cn = normalizeContainerNumber(containerNumber)

  if (kind === 'import') {
    const cached = await getImportDraftBuffer(cn)
    if (cached) {
      return { buffer: cached.buffer, filename: `导入预报_${cn}.xlsx` }
    }
    throw new Error('暂无导入预报文件')
  }

  const row = await prisma.mail_container_forecast.findUnique({
    where: { container_number: cn },
  })
  if (!row?.message_id || !row.attachment_id) {
    throw new Error('暂无源预报文件')
  }
  const buffer = await downloadGmailAttachment(row.message_id, row.attachment_id)
  const filename = row.source_filename ?? `源预报_${cn}.xlsx`
  return { buffer, filename }
}
