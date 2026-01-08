/**
 * 执行 table_views 表迁移脚本
 * 运行命令: npx tsx scripts/run-table-views-migration.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('📊 开始执行 table_views 表迁移...\n')

    // 读取 SQL 文件
    const sqlFilePath = path.resolve(__dirname, 'migrations/create-table-views-table.sql')
    const sql = fs.readFileSync(sqlFilePath, 'utf8')

    console.log('📄 读取 SQL 文件:', sqlFilePath)
    console.log('📝 SQL 内容长度:', sql.length, '字符\n')

    // 移除注释，保留 SQL 语句
    const cleanedSql = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')

    // 分割 SQL 语句（按分号分割，过滤空行）
    const statements = cleanedSql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    console.log(`🔨 共 ${statements.length} 条 SQL 语句\n`)

    // 执行每条 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const preview = statement.substring(0, 60).replace(/\n/g, ' ')
      console.log(`⚙️  执行第 ${i + 1}/${statements.length} 条语句: ${preview}...`)
      
      try {
        await prisma.$executeRawUnsafe(statement)
        console.log(`✅ 成功\n`)
      } catch (error: any) {
        // 如果是 "already exists" 错误，视为成功
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  已存在，跳过\n`)
        } else {
          console.error(`❌ 失败:`, error.message)
          throw error
        }
      }
    }

    console.log('✅ 迁移完成！table_views 表已创建\n')
    
    // 验证表是否存在
    console.log('🔍 验证表是否存在...')
    const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'table_views'
    `
    
    if (result.length > 0) {
      console.log('✅ 表 table_views 已成功创建！')
      
      // 显示表结构
      const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'table_views'
        ORDER BY ordinal_position
      `
      
      console.log('\n📋 表结构:')
      columns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type}`)
      })
    } else {
      console.log('❌ 表未找到，迁移可能失败')
    }

    console.log('\n🎉 全部完成！')

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行迁移
runMigration()
  .then(() => {
    console.log('\n✅ 脚本执行成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })

