/**
 * 源预报 Excel 识别：对照 ERP 订单导入模板与提柜导入模板的字段画像。
 * 规则优先打分，多候选接近时再由 AI 裁决。
 */

/** 订单导入模板（录预报）核心字段 */
export const ORDER_FORECAST_CANONICAL_HEADERS = [
  '订单号',
  '客户代码',
  '订单日期',
  '操作方式',
  '目的地',
  '货柜类型',
  'ETA',
  'MBL',
  'DO',
  '送仓地点',
  '性质',
  '数量',
  '体积',
] as const

/** 提柜批量导入模板字段（多为后续操作，不是源预报） */
export const PICKUP_TEMPLATE_HEADERS = [
  'MBL',
  '柜号',
  '码头/查验站',
  '承运公司',
  'ETA',
  'LFD',
  '提柜日期',
  '现在位置',
] as const

/** 表头同义词：客户表格列名可能不一致 */
export const HEADER_SYNONYMS: Record<string, string[]> = {
  订单号: ['订单号', '柜号', '集装箱号', '箱号', 'container', 'container no', 'container number', '柜号/container'],
  客户代码: ['客户代码', '客户', 'customer', 'customer code', '客户编号'],
  订单日期: ['订单日期', '预报日期', 'order date', '日期'],
  操作方式: ['操作方式', '操作类型', 'mode', '拆柜', '直送'],
  目的地: ['目的地', '目的港', 'destination', '港口'],
  货柜类型: ['货柜类型', '柜型', '箱型', 'container type', 'size'],
  ETA: ['eta', '预计到港', '预计到港时间', '到港日期'],
  MBL: ['mbl', '提单号', 'master bill', '海运提单'],
  DO: ['do', 'd/o', '放货', 'do状态'],
  送仓地点: ['送仓地点', '仓库', 'fc', 'fba仓', 'destination fc', 'location'],
  性质: ['性质', '类型', 'detail type', 'amz', '私仓'],
  数量: ['数量', '件数', 'qty', 'quantity', '板数'],
  体积: ['体积', '方数', 'cbm', 'volume'],
  柜号: ['柜号', '订单号', 'container', '箱号'],
}

export const FORECAST_SCORE_THRESHOLD = {
  /** 明确命中，直接采用 */
  confident: 72,
  /** 进入 AI 裁决区 */
  aiTiebreak: 48,
  /** 明显不是预报 */
  reject: 25,
} as const

export function normalizeHeaderCell(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
}

export function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function headerMatchesCanonical(cell: string, canonical: string): boolean {
  const norm = normalizeHeaderCell(cell)
  if (!norm) return false
  const synonyms = HEADER_SYNONYMS[canonical] ?? [canonical]
  return synonyms.some((s) => {
    const sn = normalizeHeaderCell(s)
    return norm === sn || norm.includes(sn) || sn.includes(norm)
  })
}
