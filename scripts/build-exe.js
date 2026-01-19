/**
 * 构建可执行文件的脚本
 * 1. 使用 esbuild 将 TypeScript 编译成 CommonJS
 * 2. 使用 pkg 打包成 exe
 */

import { build } from 'esbuild'
import { execSync } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceFile = path.join(__dirname, 'excel-transfer-standalone.ts')
const outputFile = path.join(__dirname, 'excel-transfer-standalone.js')

console.log('🔨 开始构建可执行文件...\n')

// 步骤1: 使用 esbuild 编译 TypeScript
console.log('📦 步骤1: 编译 TypeScript...')
try {
  await build({
    entryPoints: [sourceFile],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs', // 使用 CommonJS 格式（pkg 支持更好）
    outfile: outputFile,
    define: {
      'import.meta.url': '""' // 定义 import.meta.url 为空字符串，避免编译错误
    },
    external: [], // 不外部化，全部打包
    minify: false,
    sourcemap: false,
  })
  console.log('✅ TypeScript 编译完成\n')
} catch (error) {
  console.error('❌ TypeScript 编译失败:', error)
  process.exit(1)
}

// 步骤2: 使用 pkg 打包
console.log('📦 步骤2: 打包成 exe...')
try {
  const distDir = path.join(__dirname, '..', 'dist')
  execSync(
    `npx pkg "${outputFile}" --targets node18-win-x64 --output-path "${distDir}"`,
    { stdio: 'inherit' }
  )
  console.log('\n✅ 打包完成！')
  console.log(`📁 输出目录: ${distDir}`)
} catch (error) {
  console.error('❌ 打包失败:', error)
  process.exit(1)
}
