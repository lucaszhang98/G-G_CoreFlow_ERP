/**
 * 创建 OMS 测试账号脚本
 * 运行方式: npx tsx scripts/create-oms-test-user.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createOMSTestUser() {
  try {
    // 检查用户是否已存在
    const existingUser = await prisma.users.findUnique({
      where: { username: 'omstest' },
    })

    if (existingUser) {
      console.log('测试账号已存在，正在更新...')
      
      // 更新密码
      const passwordHash = await bcrypt.hash('omstest123', 10)
      
      await prisma.users.update({
        where: { id: existingUser.id },
        data: {
          password_hash: passwordHash,
          role: 'oms_manager',
          status: 'active',
          name: 'OMS测试账号',
        },
      })
      
      console.log('✅ 测试账号更新成功！')
      console.log('用户名: omstest')
      console.log('密码: omstest123')
      console.log('角色: oms_manager')
    } else {
      // 创建新用户
      const passwordHash = await bcrypt.hash('omstest123', 10)
      
      const user = await prisma.users.create({
        data: {
          username: 'omstest',
          name: 'OMS测试账号',
          password_hash: passwordHash,
          role: 'oms_manager',
          status: 'active',
        },
      })
      
      console.log('✅ 测试账号创建成功！')
      console.log('用户名: omstest')
      console.log('密码: omstest123')
      console.log('角色: oms_manager')
      console.log('用户ID:', user.id.toString())
    }
  } catch (error) {
    console.error('❌ 创建测试账号失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createOMSTestUser()

