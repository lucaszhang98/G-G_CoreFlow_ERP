/**
 * 创建操作部门和仓库部门账号
 * 
 * 使用方法：
 * npx tsx scripts/create-department-users.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

// 尝试加载 .env 文件
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建部门账号...\n')

  // 生成随机密码
  function generatePassword(): string {
    // 生成8位随机密码：包含大小写字母和数字
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // 操作部门账号
  const opsPassword = generatePassword()
  const opsPasswordHash = await bcrypt.hash(opsPassword, 10)

  try {
    // 检查是否已存在
    const existingOps = await prisma.users.findUnique({
      where: { username: 'ops_dept' }
    })

    if (existingOps) {
      console.log('操作部门账号已存在，跳过创建')
    } else {
      const opsUser = await prisma.users.create({
        data: {
          username: 'ops_dept',
          password_hash: opsPasswordHash,
          full_name: '操作部门',
          role: 'oms_operator',
          status: 'active',
        },
      })
      console.log('✅ 操作部门账号创建成功')
      console.log(`   用户名: ops_dept`)
      console.log(`   密码: ${opsPassword}`)
      console.log(`   角色: oms_operator`)
      console.log(`   ID: ${opsUser.id}\n`)
    }
  } catch (error: any) {
    console.error('❌ 创建操作部门账号失败:', error.message)
  }

  // 仓库部门账号
  const warehousePassword = generatePassword()
  const warehousePasswordHash = await bcrypt.hash(warehousePassword, 10)

  try {
    // 检查是否已存在
    const existingWarehouse = await prisma.users.findUnique({
      where: { username: 'warehouse_dept' }
    })

    if (existingWarehouse) {
      console.log('仓库部门账号已存在，跳过创建')
    } else {
      const warehouseUser = await prisma.users.create({
        data: {
          username: 'warehouse_dept',
          password_hash: warehousePasswordHash,
          full_name: '仓库部门',
          role: 'wms_operator',
          status: 'active',
        },
      })
      console.log('✅ 仓库部门账号创建成功')
      console.log(`   用户名: warehouse_dept`)
      console.log(`   密码: ${warehousePassword}`)
      console.log(`   角色: wms_operator`)
      console.log(`   ID: ${warehouseUser.id}\n`)
    }
  } catch (error: any) {
    console.error('❌ 创建仓库部门账号失败:', error.message)
  }

  console.log('\n账号创建完成！')
  console.log('\n=== 账号信息汇总 ===')
  console.log('\n【操作部门账号】')
  console.log('用户名: ops_dept')
  console.log(`密码: ${opsPassword}`)
  console.log('权限:')
  console.log('  - 查看订单的预约时间、提柜时间、拆柜时间')
  console.log('  - 录预报（通过订单创建）')
  console.log('  - 写备注（订单、预约、入库、出库）')
  console.log('  - 做账单（创建和编辑发票）')
  
  console.log('\n【仓库部门账号】')
  console.log('用户名: warehouse_dept')
  console.log(`密码: ${warehousePassword}`)
  console.log('权限:')
  console.log('  - 做预约（创建和编辑预约）')
  console.log('  - 核对入库细节（查看和编辑入库管理）')
  console.log('  - 核对出库细节（查看和编辑出库管理）')
  console.log('\n请妥善保管密码信息！')
}

main()
  .catch((e) => {
    console.error('执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
