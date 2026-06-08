import { getSheetsClient } from '@/lib/google/workspace-oauth'
import { parseSpreadsheetId } from '@/lib/google/sheets-fetch'

export async function testSheetAccess(urlOrId: string) {
  const spreadsheetId = parseSpreadsheetId(urlOrId)
  if (!spreadsheetId) {
    return { ok: false as const, message: '无法解析 Google Sheet 链接' }
  }

  const sheets = await getSheetsClient()
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties.title,sheets.properties.sheetId',
  })

  const title = meta.data.properties?.title || '未命名表格'
  const sheetTabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean)

  const firstSheet = meta.data.sheets?.[0]?.properties?.title || 'Sheet1'
  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${firstSheet}!A1:Z3`,
  })

  const rows = valuesRes.data.values ?? []
  const rowCountRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${firstSheet}!A:A`,
  })
  const rowCount = (rowCountRes.data.values ?? []).filter((r) => r.some((c) => String(c).trim())).length

  return {
    ok: true as const,
    message: `已成功读取「${title}」`,
    title,
    sheetTabs,
    previewRows: rows,
    rowCount: Math.max(0, rowCount - 1),
  }
}
