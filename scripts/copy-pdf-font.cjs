/**
 * postinstall: 将 Noto Sans SC 字体复制到 public/fonts，供 PDF 在部署环境（如 Vercel）回退使用。
 */
const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const src = path.join(cwd, 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-400-normal.woff')
const destDir = path.join(cwd, 'public', 'fonts')
const dest = path.join(destDir, 'NotoSansSC-Regular.woff')

if (fs.existsSync(src)) {
  try {
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, dest)
  } catch (_) {}
}
