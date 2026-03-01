import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('开始添加三个 Boolean 字段到 delivery_appointments 表...')
  
  try {
    // 添加 can_create_sheet 字段
    console.log('添加 can_create_sheet 字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE oms.delivery_appointments 
      ADD COLUMN IF NOT EXISTS can_create_sheet BOOLEAN DEFAULT false;
    `)
    console.log('✓ can_create_sheet 字段已添加')
    
    // 添加 has_created_sheet 字段
    console.log('添加 has_created_sheet 字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE oms.delivery_appointments 
      ADD COLUMN IF NOT EXISTS has_created_sheet BOOLEAN DEFAULT false;
    `)
    console.log('✓ has_created_sheet 字段已添加')
    
    // verify_loading_sheet 字段应该已经存在，检查一下
    console.log('检查 verify_loading_sheet 字段...')
    const checkResult = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
      AND table_name = 'delivery_appointments' 
      AND column_name = 'verify_loading_sheet';
    `) as any[]
    
    if (checkResult.length === 0) {
      console.log('添加 verify_loading_sheet 字段...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE oms.delivery_appointments 
        ADD COLUMN IF NOT EXISTS verify_loading_sheet BOOLEAN DEFAULT false;
      `)
      console.log('✓ verify_loading_sheet 字段已添加')
    } else {
      console.log('✓ verify_loading_sheet 字段已存在')
    }
    
    console.log('\n✅ 所有字段添加完成！')
    
    // 验证字段是否添加成功
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
      AND table_name = 'delivery_appointments' 
      AND column_name IN ('verify_loading_sheet', 'can_create_sheet', 'has_created_sheet')
      ORDER BY column_name;
    `) as any[]
    
    console.log('\n字段验证结果:')
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (默认值: ${col.column_default})`)
    })
    
  } catch (error: any) {
    console.error('❌ 执行失败:', error.message)
    if (error.message.includes('already exists')) {
      console.log('字段可能已经存在，这是正常的')
    } else {
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
