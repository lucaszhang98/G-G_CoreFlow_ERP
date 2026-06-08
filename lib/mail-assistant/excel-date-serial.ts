/** Excel 日期序列号（1899-12-30 起算，仅日期部分） */
export function dateToExcelSerial(date: Date): number {
  const excelEpoch = new Date(1899, 11, 30)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = dateOnly.getTime() - excelEpoch.getTime()
  return Math.floor(diffMs / 86400000)
}

export function excelSerialToDate(serial: number | string): Date | null {
  const num = typeof serial === 'string' ? parseFloat(serial) : serial
  if (!Number.isFinite(num) || num < 1 || num > 100000) return null
  const excelEpoch = new Date(1899, 11, 30)
  return new Date(excelEpoch.getTime() + Math.floor(num) * 86400000)
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !isNaN(value.getTime())) return value
  if (typeof value === 'number') return excelSerialToDate(value)
  const s = String(value).trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10))
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) return new Date(parseInt(us[3], 10), parseInt(us[1], 10) - 1, parseInt(us[2], 10))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
