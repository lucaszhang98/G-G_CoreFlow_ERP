import { getCachedImportDraft } from '@/lib/mail-assistant/forecast-persistence'
import { mergeImportDraftExcelBuffers } from '@/lib/mail-assistant/merge-import-draft-buffers'
import { normalizeContainerNumber } from '@/lib/mail-assistant/forecast-template-profile'
import { orderImportService } from '@/lib/services/order-import.service'
import type { ImportError } from '@/lib/services/import/types'

export type ForecastDraftOrderImportResult = {
  success: boolean
  imported?: number
  total?: number
  errors?: ImportError[]
  containerNumbers: string[]
  skipped: Array<{ containerNumber: string; reason: string }>
  message?: string
}

/** 将邮件助手中已缓存的导入预报写入订单管理（走标准订单导入校验与事务） */
export async function importForecastDraftsToOrders(
  containerNumbers: string[],
  userId: bigint
): Promise<ForecastDraftOrderImportResult> {
  const unique = [...new Set(containerNumbers.map(normalizeContainerNumber).filter(Boolean))]
  const skipped: ForecastDraftOrderImportResult['skipped'] = []
  const buffers: Buffer[] = []
  const used: string[] = []

  for (const cn of unique) {
    const cached = await getCachedImportDraft(cn)
    if (!cached?.buffer?.length) {
      skipped.push({ containerNumber: cn, reason: '暂无导入预报，请先转换源预报' })
      continue
    }
    buffers.push(cached.buffer)
    used.push(cn)
  }

  if (buffers.length === 0) {
    return {
      success: false,
      containerNumbers: [],
      skipped,
      errors: [{ row: 0, field: 'system', message: '所选柜号均无导入预报' }],
      message: '所选柜号均无导入预报',
    }
  }

  const merged = mergeImportDraftExcelBuffers(buffers)
  const result = await orderImportService.importFromBuffer(merged, userId)

  if (result.success) {
    return {
      success: true,
      imported: result.imported,
      total: result.total,
      containerNumbers: used,
      skipped,
      message: `成功导入 ${result.imported ?? 0} 条订单明细（${used.length} 个柜号）`,
    }
  }

  return {
    success: false,
    total: result.total,
    errors: result.errors,
    containerNumbers: used,
    skipped,
    message: result.errors?.[0]?.message ?? '导入失败，请检查数据',
  }
}
