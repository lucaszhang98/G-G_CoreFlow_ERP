/**
 * 执行 FBA 和 PO 字段长度迁移脚本
 * 将相关字段长度从 1000/100 增加到 2000
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

// 尝试加载 .env 文件
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

async function runMigration() {
  console.log('开始执行 FBA 和 PO 字段长度迁移...')
  
  try {
    // 1. 修改 delivery_appointments 表的 po 字段
    console.log('修改 delivery_appointments.po 字段...')
    await prisma.$executeRaw`
      ALTER TABLE "oms"."delivery_appointments" 
      ALTER COLUMN "po" TYPE VARCHAR(2000);
    `
    console.log('✓ delivery_appointments.po 字段已更新为 VARCHAR(2000)')

    // 2. 修改 order_detail 表的 fba 字段
    console.log('修改 order_detail.fba 字段...')
    await prisma.$executeRaw`
      ALTER TABLE "public"."order_detail" 
      ALTER COLUMN "fba" TYPE VARCHAR(2000);
    `
    console.log('✓ order_detail.fba 字段已更新为 VARCHAR(2000)')

    // 3. 修改 order_detail 表的 po 字段
    console.log('修改 order_detail.po 字段...')
    await prisma.$executeRaw`
      ALTER TABLE "public"."order_detail" 
      ALTER COLUMN "po" TYPE VARCHAR(2000);
    `
    console.log('✓ order_detail.po 字段已更新为 VARCHAR(2000)')

    // 4. 修改 order_detail_item 表的 fba 字段
    console.log('修改 order_detail_item.fba 字段...')
    await prisma.$executeRaw`
      ALTER TABLE "public"."order_detail_item" 
      ALTER COLUMN "fba" TYPE VARCHAR(2000);
    `
    console.log('✓ order_detail_item.fba 字段已更新为 VARCHAR(2000)')

    console.log('\n✅ 所有字段迁移完成！')
    console.log('\n迁移摘要:')
    console.log('  - delivery_appointments.po: 1000 → 2000')
    console.log('  - order_detail.fba: 1000 → 2000')
    console.log('  - order_detail.po: 1000 → 2000')
    console.log('  - order_detail_item.fba: 100 → 2000')

  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message)
    console.error('错误详情:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行迁移
runMigration()
  .then(() => {
    console.log('\n迁移脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('未处理的错误:', error)
    process.exit(1)
  })
