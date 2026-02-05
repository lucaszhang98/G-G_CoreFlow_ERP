/**
 * Logo 解析：在开发与正式环境都能找到 logo，找不到时使用内嵌 base64 占位
 * 装车单、BOL 等 PDF 统一使用此模块
 */

import path from 'path'
import fs from 'fs'

/** 候选 logo 路径（相对 process.cwd() 或绝对） */
const LOGO_CANDIDATES = [
  'public/loading-sheet/logo.png',
  'public/logo.png',
  'docs/logo.png',
]

/** 内嵌占位图：1x1 像素 PNG（base64），正式环境找不到文件时使用，PDF 中通过 width/height 放大显示 */
const EMBEDDED_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAOhgGAUj+QOgAAAABJRU5ErkJggg=='

function tryReadAsDataUrl(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
    const buf = fs.readFileSync(filePath)
    const base64 = buf.toString('base64')
    return `data:image/png;base64,${base64}`
  } catch {
    return null
  }
}

/**
 * 返回可用于 @react-pdf/renderer <Image src={...} /> 的 data URL。
 * 优先使用传入的 logoPath，否则依次尝试 public/loading-sheet/logo.png 等；
 * 找不到文件时使用内嵌 base64，保证正式环境也有 logo 显示。
 * 统一用 data URL 避免正式环境 file:// 路径不可用。
 */
export function getLogoDataUrl(logoPath?: string): string {
  const cwd = process.cwd()

  if (logoPath) {
    const full = path.isAbsolute(logoPath) ? logoPath : path.join(cwd, logoPath)
    const dataUrl = tryReadAsDataUrl(full)
    if (dataUrl) return dataUrl
  }

  for (const rel of LOGO_CANDIDATES) {
    const full = path.join(cwd, rel)
    const dataUrl = tryReadAsDataUrl(full)
    if (dataUrl) return dataUrl
  }

  return `data:image/png;base64,${EMBEDDED_LOGO_BASE64}`
}
