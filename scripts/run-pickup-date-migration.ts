import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

// ESM 模块中获取当前目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
  try {
    console.log('开始修改 pickup_date 字段类型...')

    // 分别执行每条 SQL 语句
    
    // 1. 修改字段类型
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.orders 
      ALTER COLUMN pickup_date TYPE TIMESTAMPTZ 
      USING pickup_date::TIMESTAMPTZ
    `)
    console.log('✅ 字段类型已修改')
    
    // 2. 添加注释
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN public.orders.pickup_date IS '提柜日期和时间（带时区）'
    `)
    console.log('✅ 字段注释已添加')

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

