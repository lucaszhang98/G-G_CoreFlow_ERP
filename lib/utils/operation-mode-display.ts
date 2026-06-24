/** 操作方式展示样式：拆柜红、直送蓝（支持库内值与中文标签） */
export function getOperationModeTextClass(value: string | null | undefined): string {
  if (!value) return ''
  if (value === 'unload' || value === '拆柜') {
    return 'text-red-600 dark:text-red-400 font-medium'
  }
  if (value === 'direct_delivery' || value === '直送') {
    return 'text-blue-600 dark:text-blue-400 font-medium'
  }
  return ''
}

export function formatOperationModeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  if (value === 'unload' || value === '拆柜') return '拆柜'
  if (value === 'direct_delivery' || value === '直送') return '直送'
  return value
}
