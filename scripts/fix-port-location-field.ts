import prisma from '../lib/prisma'

async function main() {
  console.log('修复提柜管理的码头字段...\n')

  try {
    // 重命名 port_location 为 port_text（如果存在）
    console.log('1. 重命名字段 port_location -> port_text...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tms.pickup_management 
      RENAME COLUMN port_location TO port_text
    `)
    console.log('✅ 字段重命名成功\n')

    // 更新注释
    console.log('2. 更新字段注释...')
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN tms.pickup_management.port_text IS '码头位置文本（额外信息）'
    `)
    console.log('✅ 注释更新成功\n')

    console.log('🎉 修复完成！\n')
    console.log('说明：')
    console.log('  - "码头/查验站" 字段：关联到 locations 表（来自 orders 表）')
    console.log('  - "码头位置" 字段 (port_text)：文本类型，额外信息')

  } catch (error: any) {
    console.error('❌ 修复失败:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

