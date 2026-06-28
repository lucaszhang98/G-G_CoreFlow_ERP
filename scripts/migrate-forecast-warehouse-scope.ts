/**
 * 多仓改造：库存预测汇总表按仓隔离。
 * - analytics.inventory_forecast_daily 增加 warehouse_id 列
 * - 旧唯一约束/索引 unique_location_date(location_id, location_group, forecast_date)
 *   改为 (warehouse_id, location_id, location_group, forecast_date)
 * - 新增 warehouse_id 索引
 *
 * 幂等：可重复执行。现存数据 warehouse_id 保持 NULL（归入「全部仓库」聚合桶），
 * 各仓管理员重新计算后会写入对应 warehouse_id 的数据。
 */
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
  console.log('开始：库存预测汇总表按仓隔离\n')

  console.log('1) 增加 warehouse_id 列（若不存在）...')
  await prisma.$executeRawUnsafe(
    `ALTER TABLE analytics.inventory_forecast_daily ADD COLUMN IF NOT EXISTS warehouse_id BIGINT`,
  )

  console.log('2) 删除旧唯一约束/索引 unique_location_date（若存在）...')
  // 可能是约束或独立索引，两种都尝试删除
  await prisma.$executeRawUnsafe(
    `ALTER TABLE analytics.inventory_forecast_daily DROP CONSTRAINT IF EXISTS unique_location_date`,
  )
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS analytics.unique_location_date`,
  )

  console.log('3) 创建新复合唯一索引 (warehouse_id, location_id, location_group, forecast_date) ...')
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_location_date ON analytics.inventory_forecast_daily (warehouse_id, location_id, location_group, forecast_date)`,
  )

  console.log('4) 创建 warehouse_id 索引（若不存在）...')
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_forecast_warehouse_id ON analytics.inventory_forecast_daily (warehouse_id)`,
  )

  console.log('\n✅ 全部完成')
}

main()
  .catch(async (e) => {
    console.error('❌ 迁移失败:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
