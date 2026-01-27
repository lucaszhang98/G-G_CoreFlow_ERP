/**
 * 验证 FBA 和 PO 字段长度迁移结果
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

async function verifyMigration() {
  console.log('开始验证字段长度...\n')
  
  try {
    // 查询字段信息
    const results = await prisma.$queryRaw<Array<{
      table_schema: string
      table_name: string
      column_name: string
      character_maximum_length: number | null
    }>>`
      SELECT 
        table_schema,
        table_name,
        column_name,
        character_maximum_length
      FROM information_schema.columns
      WHERE 
        (table_schema = 'oms' AND table_name = 'delivery_appointments' AND column_name = 'po')
        OR (table_schema = 'public' AND table_name = 'order_detail' AND column_name IN ('fba', 'po'))
        OR (table_schema = 'public' AND table_name = 'order_detail_item' AND column_name = 'fba')
      ORDER BY table_schema, table_name, column_name;
    `

    console.log('字段长度验证结果:')
    console.log('=' .repeat(60))
    
    const expectedLengths: Record<string, number> = {
      'oms.delivery_appointments.po': 2000,
      'public.order_detail.fba': 2000,
      'public.order_detail.po': 2000,
      'public.order_detail_item.fba': 2000,
    }

    let allCorrect = true
    for (const row of results) {
      const key = `${row.table_schema}.${row.table_name}.${row.column_name}`
      const expected = expectedLengths[key]
      const actual = row.character_maximum_length
      const status = expected === actual ? '✅' : '❌'
      
      console.log(`${status} ${key}`)
      console.log(`   期望长度: ${expected}, 实际长度: ${actual}`)
      
      if (expected !== actual) {
        allCorrect = false
      }
    }

    console.log('=' .repeat(60))
    
    if (allCorrect) {
      console.log('\n✅ 所有字段长度验证通过！')
    } else {
      console.log('\n❌ 部分字段长度不符合预期，请检查迁移是否完整。')
    }

  } catch (error: any) {
    console.error('❌ 验证失败:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyMigration()
  .then(() => {
    console.log('\n验证完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('未处理的错误:', error)
    process.exit(1)
  })
