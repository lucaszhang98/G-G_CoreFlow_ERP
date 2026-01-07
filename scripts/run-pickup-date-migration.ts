import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('开始修改 pickup_date 字段类型...')

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'fix-pickup-date-type.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')

    // 执行 SQL
    await prisma.$executeRawUnsafe(sql)

    console.log('✅ pickup_date 字段类型已成功修改为 TIMESTAMPTZ')
    console.log('现在可以保存完整的日期和时间信息了！')
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()

