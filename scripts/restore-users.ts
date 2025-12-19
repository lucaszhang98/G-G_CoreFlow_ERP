/**
 * 恢复系统用户账号脚本
 * 运行方式: npx tsx scripts/restore-users.ts
 * 
 * 创建两个账号：
 * 1. 管理员账号：admin / admin123 (role: admin)
 * 2. OMS测试账号：omstest / omstest123 (role: oms_manager)
 */

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function restoreUsers() {
  try {
    console.log('🔄 开始恢复系统用户账号...\n')

    // 1. 创建/更新管理员账号
    console.log('📝 处理管理员账号...')
    const adminPasswordHash = await bcrypt.hash('admin123', 10)
    const adminUser = await prisma.users.upsert({
      where: { username: 'admin' },
      update: {
        password_hash: adminPasswordHash,
        name: '系统管理员',
        role: 'admin',
        status: 'active',
      },
      create: {
        username: 'admin',
        name: '系统管理员',
        password_hash: adminPasswordHash,
        role: 'admin',
        status: 'active',
      },
    })
    console.log('✅ 管理员账号已恢复')
    console.log('   用户名: admin')
    console.log('   密码: admin123')
    console.log('   角色: admin (拥有全部权限)')
    console.log('   用户ID:', adminUser.id.toString())
    console.log('')

    // 2. 创建/更新 OMS 测试账号
    console.log('📝 处理 OMS 测试账号...')
    const omsPasswordHash = await bcrypt.hash('omstest123', 10)
    const omsUser = await prisma.users.upsert({
      where: { username: 'omstest' },
      update: {
        password_hash: omsPasswordHash,
        name: 'OMS测试账号',
        role: 'oms_manager',
        status: 'active',
      },
      create: {
        username: 'omstest',
        name: 'OMS测试账号',
        password_hash: omsPasswordHash,
        role: 'oms_manager',
        status: 'active',
      },
    })
    console.log('✅ OMS 测试账号已恢复')
    console.log('   用户名: omstest')
    console.log('   密码: omstest123')
    console.log('   角色: oms_manager (仅限主数据和OMS模块)')
    console.log('   用户ID:', omsUser.id.toString())
    console.log('')

    console.log('✅ 所有用户账号恢复完成！')
    console.log('')
    console.log('📋 账号信息汇总:')
    console.log('   1. 管理员账号: admin / admin123')
    console.log('   2. OMS测试账号: omstest / omstest123')
  } catch (error) {
    console.error('❌ 恢复用户账号失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

restoreUsers()


