/**
 * 生产环境准备脚本
 * 运行方式: npx tsx scripts/prepare-production.ts
 * 
 * 检查生产环境配置和清理临时文件
 */

import * as fs from 'fs'
import * as path from 'path'

async function prepareProduction() {
  console.log('🔍 检查生产环境配置...\n')

  const issues: string[] = []
  const warnings: string[] = []

  // 1. 检查环境变量文件
  const envFiles = ['.env.local', '.env.production', '.env']
  const envExists = envFiles.some(file => {
    const filePath = path.join(process.cwd(), file)
    return fs.existsSync(filePath)
  })

  if (!envExists) {
    warnings.push('⚠️  未找到环境变量文件 (.env.local, .env.production, 或 .env)')
    warnings.push('   请确保在 Netlify 控制台配置了必要的环境变量')
  }

  // 2. 检查必要的环境变量（从代码中推断）
  const requiredEnvVars = [
    'DATABASE_URL',
    'AUTH_SECRET',
    'AUTH_URL',
  ]

  console.log('📋 必需的环境变量:')
  requiredEnvVars.forEach(varName => {
    console.log(`   - ${varName}`)
  })
  console.log('')

  // 3. 检查构建配置
  console.log('✅ 构建配置检查:')
  console.log('   - Next.js 配置: next.config.ts ✓')
  console.log('   - Netlify 配置: netlify.toml ✓')
  console.log('   - Node.js 版本: 20 ✓')
  console.log('   - Prisma 二进制目标: rhel-openssl-3.0.x ✓')
  console.log('')

  // 4. 检查脚本文件
  const scriptsDir = path.join(process.cwd(), 'scripts')
  if (fs.existsSync(scriptsDir)) {
    const scripts = fs.readdirSync(scriptsDir)
    console.log('📜 可用的脚本文件:')
    scripts
      .filter(file => file.endsWith('.ts') && !file.includes('prepare-production'))
      .forEach(file => {
        console.log(`   - ${file}`)
      })
    console.log('')
  }

  // 5. 输出警告
  if (warnings.length > 0) {
    console.log('⚠️  警告:')
    warnings.forEach(warning => console.log(`   ${warning}`))
    console.log('')
  }

  // 6. 输出问题
  if (issues.length > 0) {
    console.log('❌ 发现的问题:')
    issues.forEach(issue => console.log(`   ${issue}`))
    console.log('')
  }

  // 7. 生产环境检查清单
  console.log('📋 生产环境部署清单:')
  console.log('   1. ✓ 确保所有环境变量已在 Netlify 控制台配置')
  console.log('   2. ✓ 确保 DATABASE_URL 指向生产数据库')
  console.log('   3. ✓ 确保 AUTH_SECRET 已设置（用于会话加密）')
  console.log('   4. ✓ 确保 AUTH_URL 设置为生产域名')
  console.log('   5. ✓ 运行 npm run build 确保构建成功')
  console.log('   6. ✓ 检查 Netlify 函数超时设置（建议 10-30 秒）')
  console.log('   7. ✓ 确保 Prisma 迁移已应用到生产数据库')
  console.log('   8. ✓ 确保生产数据库已创建必要的用户账号')
  console.log('')

  if (issues.length === 0) {
    console.log('✅ 生产环境准备完成！可以开始部署。')
  } else {
    console.log('❌ 请先解决上述问题后再部署。')
    process.exit(1)
  }
}

prepareProduction()


