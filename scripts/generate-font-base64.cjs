/**
 * 读取 Noto Sans SC woff，生成 font-base64.ts（构建时内嵌，PDF 不依赖运行时路径）
 */
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const candidates = [
  path.join(cwd, 'public', 'fonts', 'NotoSansSC-Regular.woff'),
  path.join(cwd, 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-400-normal.woff'),
]

let buf = null
for (const p of candidates) {
  if (fs.existsSync(p)) {
    buf = fs.readFileSync(p)
    if (buf.length > 1000) break
  }
}

const outPath = path.join(cwd, 'lib', 'services', 'print', 'font-base64.ts')
if (!buf || buf.length < 1000) {
  // 无可用字体时写占位，避免 import 报错；注册会失败，PDF 用 Helvetica
  fs.writeFileSync(outPath, `// 未找到字体，请运行 postinstall 或确保 public/fonts/NotoSansSC-Regular.woff 存在\nexport const NOTO_SANS_SC_BASE64 = ''\n`)
  process.exit(0)
}

const base64 = buf.toString('base64')
const content = `/**
 * 自动生成，请勿手改。来源：Noto Sans SC (woff)，用于 PDF 中文显示。
 * 由 scripts/generate-font-base64.cjs 在 postinstall/prebuild 时生成。
 */
export const NOTO_SANS_SC_BASE64 = ${JSON.stringify(base64)}
`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, content)
console.log('[generate-font-base64] 已写入', outPath, '长度', base64.length)
