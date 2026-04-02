/**
 * 预约管理 / 出库管理等共用的「预约账号」「预约类型」下拉选项（单一数据源）
 */

export const DELIVERY_APPOINTMENT_ACCOUNT_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: 'AA', value: 'AA' },
  { label: 'YTAQ', value: 'YTAQ' },
  { label: 'AYIE', value: 'AYIE' },
  { label: 'KP', value: 'KP' },
  { label: 'OLPN', value: 'OLPN' },
  { label: 'DATONG', value: 'DATONG' },
  { label: 'GG', value: 'GG' },
  { label: 'WGUY', value: 'WGUY' },
  { label: 'Other', value: 'other' },
]

export const DELIVERY_APPOINTMENT_TYPE_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: '地板', value: '地板' },
  { label: '卡板', value: '卡板' },
]

export const DELIVERY_APPOINTMENT_ACCOUNT_VALUE_SET = new Set(
  DELIVERY_APPOINTMENT_ACCOUNT_SELECT_OPTIONS.map((o) => o.value)
)

export const DELIVERY_APPOINTMENT_TYPE_VALUE_SET = new Set(
  DELIVERY_APPOINTMENT_TYPE_SELECT_OPTIONS.map((o) => o.value)
)
