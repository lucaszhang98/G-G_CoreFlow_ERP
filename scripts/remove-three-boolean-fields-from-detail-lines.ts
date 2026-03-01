import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('开始删除明细行表中的三个 Boolean 字段...')
  
  try {
    // 从 appointment_detail_lines 删除 can_create_sheet
    console.log('从 appointment_detail_lines 删除 can_create_sheet 字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE oms.appointment_detail_lines 
      DROP COLUMN IF EXISTS can_create_sheet;
    `)
    console.log('✓ can_create_sheet 字段已从 appointment_detail_lines 删除')
    
    // 从 outbound_shipment_lines 删除 verify_loading_sheet
    console.log('从 outbound_shipment_lines 删除 verify_loading_sheet 字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE wms.outbound_shipment_lines 
      DROP COLUMN IF EXISTS verify_loading_sheet;
    `)
    console.log('✓ verify_loading_sheet 字段已从 outbound_shipment_lines 删除')
    
    // 从 outbound_shipment_lines 删除 has_created_sheet
    console.log('从 outbound_shipment_lines 删除 has_created_sheet 字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE wms.outbound_shipment_lines 
      DROP COLUMN IF EXISTS has_created_sheet;
    `)
    console.log('✓ has_created_sheet 字段已从 outbound_shipment_lines 删除')
    
    console.log('\n✅ 所有字段删除完成！')
    
  } catch (error: any) {
    console.error('❌ 执行失败:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
