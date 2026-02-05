/**
 * 装车单 / BOL / 拆柜单等 PDF 共用：注册 Noto Sans SC 中文字体，避免乱码。
 * 字体以 base64 内嵌在 font-base64.ts（构建时生成），不依赖运行时路径。
 */
import { Font } from '@react-pdf/renderer'
import { NOTO_SANS_SC_BASE64 } from './font-base64'

const FONT_FAMILY = 'NotoSansSC'

let registered = false

function register(): boolean {
  if (registered) return true
  if (!NOTO_SANS_SC_BASE64 || NOTO_SANS_SC_BASE64.length < 100) return false
  try {
    Font.register({
      family: FONT_FAMILY,
      src: `data:application/octet-stream;base64,${NOTO_SANS_SC_BASE64}`,
    })
    registered = true
    return true
  } catch {
    return false
  }
}

register()

/** 在生成 PDF 前调用，确保字体已注册 */
export function ensurePdfFont(): void {
  register()
}

export const pdfFontRegistered = registered
export const pdfFontFamily = registered ? FONT_FAMILY : 'Helvetica'
