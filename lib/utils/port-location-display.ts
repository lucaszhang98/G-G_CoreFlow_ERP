/** 码头/查验站展示样式：ETS 绿、OICT 蓝、TRAPAC 橙（不区分大小写） */
export function getPortLocationTextClass(value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.trim().toUpperCase()
  if (normalized === 'ETS') {
    return 'text-green-600 dark:text-green-400 font-medium'
  }
  if (normalized === 'OICT') {
    return 'text-blue-600 dark:text-blue-400 font-medium'
  }
  if (normalized === 'TRAPAC') {
    return 'text-orange-600 dark:text-orange-400 font-medium'
  }
  return ''
}
