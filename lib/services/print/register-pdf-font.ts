/**
 * 装车单 / BOL / 拆柜单等 PDF 共用：注册 Noto Sans SC 中文字体，避免乱码。
 * 优先用 createRequire 解析包路径（不依赖 process.cwd），再回退到 cwd + node_modules / public/fonts。
 */
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import { Font } from '@react-pdf/renderer'

const FONT_FAMILY = 'NotoSansSC'
const FONT_FILE = 'noto-sans-sc-chinese-simplified-400-normal.woff'

let registered = false

function register(): boolean {
  if (registered) return true

  const candidates: string[] = []

  try {
    const req = createRequire(import.meta.url)
    const pkgPath = req.resolve('@fontsource/noto-sans-sc/package.json')
    candidates.push(path.join(path.dirname(pkgPath), 'files', FONT_FILE))
  } catch {
    // 包未安装或解析失败
  }

  const cwd = process.cwd()
  candidates.push(
    path.join(cwd, 'node_modules', '@fontsource', 'noto-sans-sc', 'files', FONT_FILE),
    path.join(cwd, 'public', 'fonts', 'NotoSansSC-Regular.woff'),
  )

  for (const fontPath of candidates) {
    try {
      if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000) {
        Font.register({ family: FONT_FAMILY, src: fontPath })
        registered = true
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

register()

export const pdfFontRegistered = registered
export const pdfFontFamily = registered ? FONT_FAMILY : 'Helvetica'
