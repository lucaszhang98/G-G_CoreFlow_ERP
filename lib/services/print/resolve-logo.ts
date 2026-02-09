/**
 * 仅在 API 层调用：解析 logo 为 data URL，供装车单/BOL PDF 使用。
 * 支持 JPEG 与 PNG：public/loading-sheet/logo.jpg 或 logo.png，按文件头识别格式。
 * 若遇 Z_DATA_ERROR，建议改用真实 JPEG（不要用 PNG 改扩展名）。
 */
import path from 'path'
import fs from 'fs'

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function isJpegBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === JPEG_MAGIC[0] && buf[1] === JPEG_MAGIC[1] && buf[2] === JPEG_MAGIC[2]
}

function isPngBuffer(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)
}

let cachedLogo: string | null | undefined = undefined

/** 先读本地 public/loading-sheet/logo.jpg 或 logo.png，没有则请求公网；按魔数识别 JPEG/PNG。进程内缓存，批量打印只读一次。 */
export async function resolveLogoDataUrl(): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo
  const dir = path.join(process.cwd(), 'public', 'loading-sheet')
  const candidates = ['logo.jpg', 'logo.jpeg', 'logo.png']
  for (const name of candidates) {
    const p = path.join(dir, name)
    try {
      if (!fs.existsSync(p)) continue
      const buf = fs.readFileSync(p)
      if (isJpegBuffer(buf)) {
        cachedLogo = `data:image/jpeg;base64,${buf.toString('base64')}`
        return cachedLogo
      }
      if (isPngBuffer(buf)) {
        cachedLogo = `data:image/png;base64,${buf.toString('base64')}`
        return cachedLogo
      }
    } catch {
      // 忽略单文件读取失败，继续尝试下一个
    }
  }
  try {
    const url = 'https://raw.githubusercontent.com/lucaszhang98/G-G_CoreFlow_ERP/main/public/loading-sheet/logo.jpg'
    const res = await fetch(url)
    if (!res.ok) {
      cachedLogo = null
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (isJpegBuffer(buf)) {
      cachedLogo = `data:image/jpeg;base64,${buf.toString('base64')}`
      return cachedLogo
    }
    if (isPngBuffer(buf)) {
      cachedLogo = `data:image/png;base64,${buf.toString('base64')}`
      return cachedLogo
    }
    cachedLogo = null
    return null
  } catch {
    cachedLogo = null
    return null
  }
}
