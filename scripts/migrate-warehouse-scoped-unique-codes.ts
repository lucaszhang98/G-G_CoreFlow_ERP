/**
 * 多仓改造：把主数据编码的「全局唯一」改为「仓库内唯一」。
 * - customers.code            -> UNIQUE(warehouse_id, code)
 * - locations.location_code   -> UNIQUE(warehouse_id, location_code)
 * - carriers.carrier_code     -> UNIQUE(warehouse_id, carrier_code)
 *
 * 做法：动态查找并删除旧的单列唯一约束/索引，再创建复合唯一索引（幂等）。
 * 现存数据全部在 OAK(1000)，无冲突，创建复合唯一索引可直接成功。
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

type Target = {
  schema: string
  table: string
  column: string
  newIndex: string
}

const targets: Target[] = [
  { schema: 'public', table: 'customers', column: 'code', newIndex: 'customers_warehouse_code_uniq' },
  { schema: 'public', table: 'locations', column: 'location_code', newIndex: 'locations_warehouse_code_uniq' },
  { schema: 'public', table: 'carriers', column: 'carrier_code', newIndex: 'carriers_warehouse_code_uniq' },
]

async function dropSingleColumnUnique(t: Target) {
  // 1) 删除单列唯一「约束」（pg_constraint contype='u'）
  const cons = await prisma.$queryRawUnsafe<Array<{ conname: string }>>(
    `
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = $1 AND rel.relname = $2 AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname ORDER BY att.attnum)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
      ) = ARRAY[$3]::name[]
    `,
    t.schema,
    t.table,
    t.column,
  )
  for (const c of cons) {
    console.log(`  删除唯一约束 ${c.conname} ...`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t.schema}"."${t.table}" DROP CONSTRAINT "${c.conname}"`)
  }

  // 2) 删除单列唯一「索引」（不是约束所支撑的）
  const idxs = await prisma.$queryRawUnsafe<Array<{ relname: string }>>(
    `
    SELECT i.relname
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE ns.nspname = $1 AND t.relname = $2
      AND ix.indisunique AND NOT ix.indisprimary
      AND ix.indnatts = 1
      AND (
        SELECT att.attname FROM pg_attribute att
        WHERE att.attrelid = t.oid AND att.attnum = ix.indkey[0]
      ) = $3
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = ix.indexrelid)
    `,
    t.schema,
    t.table,
    t.column,
  )
  for (const i of idxs) {
    if (i.relname === t.newIndex) continue
    console.log(`  删除唯一索引 ${i.relname} ...`)
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${t.schema}"."${i.relname}"`)
  }
}

async function main() {
  console.log('开始：主数据编码改为「仓库内唯一」\n')
  for (const t of targets) {
    console.log(`处理 ${t.schema}.${t.table}.${t.column}`)
    await dropSingleColumnUnique(t)
    console.log(`  创建复合唯一索引 ${t.newIndex} (warehouse_id, ${t.column}) ...`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${t.newIndex}" ON "${t.schema}"."${t.table}" ("warehouse_id", "${t.column}")`,
    )
    console.log(`  ✅ 完成 ${t.table}\n`)
  }
  console.log('✅ 全部完成')
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
