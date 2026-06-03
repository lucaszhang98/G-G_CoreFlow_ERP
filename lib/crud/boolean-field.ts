/**
 * 布尔字段读写：false 为有效值，仅 undefined/null 表示「未提交」。
 */

export function isExplicitBoolean(value: unknown): value is boolean {
  return value === true || value === false
}

export function coerceExplicitBoolean(value: unknown): boolean | undefined {
  if (value === true || value === false) return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return undefined
}

export function hasOwnPropertyKey(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}
