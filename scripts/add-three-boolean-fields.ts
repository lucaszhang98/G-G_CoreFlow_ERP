import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('开始添加三个 Boolean 字段...\n')

  try {
    // 1. 检查并添加 can_create_sheet 到 appointment_detail_lines
    console.log('检查 appointment_detail_lines.can_create_sheet...')
    const checkCanCreateSheet = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
        AND table_name = 'appointment_detail_lines' 
        AND column_name = 'can_create_sheet'
    `
    
    if (checkCanCreateSheet.length === 0) {
      console.log('添加 can_create_sheet 字段...')
      await prisma.$executeRaw`
        ALTER TABLE oms.appointment_detail_lines 
        ADD COLUMN can_create_sheet BOOLEAN DEFAULT false
      `
      console.log('✅ can_create_sheet 字段添加成功')
    } else {
      console.log('⚠️  can_create_sheet 字段已存在，跳过')
    }

    // 2. 检查并添加 verify_loading_sheet 到 outbound_shipment_lines
    console.log('\n检查 outbound_shipment_lines.verify_loading_sheet...')
    const checkVerifyLoadingSheet = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'wms' 
        AND table_name = 'outbound_shipment_lines' 
        AND column_name = 'verify_loading_sheet'
    `
    
    if (checkVerifyLoadingSheet.length === 0) {
      console.log('添加 verify_loading_sheet 字段...')
      await prisma.$executeRaw`
        ALTER TABLE wms.outbound_shipment_lines 
        ADD COLUMN verify_loading_sheet BOOLEAN DEFAULT false
      `
      console.log('✅ verify_loading_sheet 字段添加成功')
    } else {
      console.log('⚠️  verify_loading_sheet 字段已存在，跳过')
    }

    // 3. 检查并添加 has_created_sheet 到 outbound_shipment_lines
    console.log('\n检查 outbound_shipment_lines.has_created_sheet...')
    const checkHasCreatedSheet = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'wms' 
        AND table_name = 'outbound_shipment_lines' 
        AND column_name = 'has_created_sheet'
    `
    
    if (checkHasCreatedSheet.length === 0) {
      console.log('添加 has_created_sheet 字段...')
      await prisma.$executeRaw`
        ALTER TABLE wms.outbound_shipment_lines 
        ADD COLUMN has_created_sheet BOOLEAN DEFAULT false
      `
      console.log('✅ has_created_sheet 字段添加成功')
    } else {
      console.log('⚠️  has_created_sheet 字段已存在，跳过')
    }

    console.log('\n✅ 所有字段添加完成！')
  } catch (error: any) {
    console.error('❌ 添加字段失败:', error)
    throw error
  }
}

main()
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
