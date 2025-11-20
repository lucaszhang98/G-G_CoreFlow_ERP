/**
 * 格式化工具函数
 */

/**
 * 格式化货币
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (!amount && amount !== 0) return "-"
  const numValue = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (isNaN(numValue)) return "-"
  return `$${numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * 格式化数字（千分位）
 */
export function formatNumber(value: number | null | string | undefined): string {
  if (!value && value !== 0) return "-"
  const numValue = typeof value === 'string' 
    ? parseFloat(value) 
    : Number(value)
  if (isNaN(numValue)) return "-"
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

