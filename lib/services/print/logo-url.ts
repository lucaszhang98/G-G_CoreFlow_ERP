/**
 * 装车单/BOL 等 PDF 使用的 Logo 公网 URL，正式环境直接拉取
 * 可通过环境变量 LOGO_URL 或 NEXT_PUBLIC_LOGO_URL 覆盖
 */
const DEFAULT_LOGO_URL =
  'https://raw.githubusercontent.com/lucaszhang98/G-G_CoreFlow_ERP/main/public/loading-sheet/logo.png'

export function getPdfLogoUrl(override?: string): string | null {
  const url = override || process.env.LOGO_URL || process.env.NEXT_PUBLIC_LOGO_URL || DEFAULT_LOGO_URL
  return url || null
}
