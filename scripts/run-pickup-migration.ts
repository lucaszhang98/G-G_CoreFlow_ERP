import prisma from '../lib/prisma'

async function main() {
  console.log('开始添加提柜管理新字段...\n')

  try {
    // 1. 添加码头位置字段
    console.log('1. 添加码头位置字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tms.pickup_management 
      ADD COLUMN IF NOT EXISTS port_location VARCHAR(10)
    `)
    console.log('✅ 码头位置字段添加成功\n')

    // 2. 添加船司字段
    console.log('2. 添加船司字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tms.pickup_management 
      ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(10)
    `)
    console.log('✅ 船司字段添加成功\n')

    // 3. 添加司机ID字段
    console.log('3. 添加司机ID字段...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tms.pickup_management 
      ADD COLUMN IF NOT EXISTS driver_id BIGINT
    `)
    console.log('✅ 司机ID字段添加成功\n')

    // 4. 添加外键约束
    console.log('4. 添加外键约束...')
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'pickup_management_driver_id_fkey'
          ) THEN
              ALTER TABLE tms.pickup_management
              ADD CONSTRAINT pickup_management_driver_id_fkey
              FOREIGN KEY (driver_id) 
              REFERENCES public.drivers(driver_id)
              ON DELETE SET NULL
              ON UPDATE CASCADE;
          END IF;
      END $$;
    `)
    console.log('✅ 外键约束添加成功\n')

    // 5. 添加索引
    console.log('5. 添加索引...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_pickup_management_driver_id 
      ON tms.pickup_management(driver_id)
    `)
    console.log('✅ 索引添加成功\n')

    // 6. 添加注释
    console.log('6. 添加字段注释...')
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN tms.pickup_management.port_location IS '码头位置（文本）'
    `)
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN tms.pickup_management.shipping_line IS '船司（文本）'
    `)
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN tms.pickup_management.driver_id IS '司机ID（关联drivers表）'
    `)
    console.log('✅ 字段注释添加成功\n')

    console.log('🎉 所有字段添加完成！\n')
    console.log('新增字段：')
    console.log('  - port_location (VARCHAR(10)) - 码头位置')
    console.log('  - shipping_line (VARCHAR(10)) - 船司')
    console.log('  - driver_id (BIGINT) - 司机（关联drivers表）')

  } catch (error: any) {
    console.error('❌ 迁移失败:', error.message)
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

