import type { WorkspaceCredentials } from '@/lib/google/workspace-credentials'
import { getGoogleSessionCookies } from '@/lib/google/google-session'

export function parseSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  return null
}

export async function fetchSheetCsv(
  credentials: WorkspaceCredentials,
  spreadsheetId: string,
  gid = '0'
): Promise<{ ok: boolean; csv?: string; message: string }> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`

  // 先尝试无需登录的 gviz 导出（表格已公开或组织内可访问时可能成功）
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
  const publicRes = await fetch(gvizUrl, { redirect: 'follow' })
  if (publicRes.ok) {
    const csv = await publicRes.text()
    if (csv && !csv.includes('<!DOCTYPE html')) {
      return { ok: true, csv, message: '已通过公开/链接访问读取 Sheet' }
    }
  }

  // 使用账号密码登录后带 Cookie 拉取
  try {
    const cookieHeader = await getGoogleSessionCookies(credentials.email, credentials.password)
    const authedRes = await fetch(exportUrl, {
      headers: { Cookie: cookieHeader },
      redirect: 'follow',
    })

    if (!authedRes.ok) {
      return {
        ok: false,
        message: `Sheet 导出失败（HTTP ${authedRes.status}），请确认该账号有表格访问权限`,
      }
    }

    const csv = await authedRes.text()
    if (csv.includes('<!DOCTYPE html') || csv.includes('accounts.google.com')) {
      return {
        ok: false,
        message:
          'Sheet 登录后仍无法读取，可能触发了 Google 二次验证。请在 Google 管理后台为该账号关闭登录挑战，或改用应用专用密码。',
      }
    }

    return { ok: true, csv, message: '已通过账号密码登录读取 Sheet' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '读取 Sheet 失败',
    }
  }
}

export function parseContainerNumbersFromCsv(csv: string, columnName = '柜号'): string[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0])
  const colIdx = headers.findIndex((h) => h.trim() === columnName)
  const targetIdx = colIdx >= 0 ? colIdx : 0

  const containers: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const value = (cols[targetIdx] ?? '').trim()
    if (value) containers.push(value)
  }
  return containers
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }
    current += ch
  }
  result.push(current)
  return result
}
