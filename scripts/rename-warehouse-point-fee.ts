/**
 * 将全部「仓点费」费用行重命名为「超仓费」，编码改为 extended location fee。
 * 运行：npx tsx scripts/rename-warehouse-point-fee.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import prisma from '../lib/prisma'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const NEW_FEE_CODE = 'extended location fee'
const NEW_FEE_NAME = '超仓费'
const OLD_FEE_NAME = '仓点费'

async function main() {
  const before = await prisma.fee.count({ where: { fee_name: OLD_FEE_NAME } })
  if (before === 0) {
    console.log('没有需要更新的「仓点费」记录')
    return
  }

  const updated = await prisma.fee.updateMany({
    where: { fee_name: OLD_FEE_NAME },
    data: {
      fee_code: NEW_FEE_CODE,
      fee_name: NEW_FEE_NAME,
      updated_at: new Date(),
    },
  })

  const after = await prisma.fee.count({ where: { fee_name: NEW_FEE_NAME, fee_code: NEW_FEE_CODE } })
  console.log(`已更新 ${updated.count} 条费用（原「${OLD_FEE_NAME}」→「${NEW_FEE_NAME}」/ ${NEW_FEE_CODE}）`)
  console.log(`当前匹配新名称+编码的记录数：${after}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
