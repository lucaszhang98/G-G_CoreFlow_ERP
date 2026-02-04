/**
 * 创建 TMS 经理账号（权限与 lin 相同：tms_manager）
 *
 * 用法（请替换为新账号的用户名和初始密码）：
 *   NEW_USERNAME=新用户名 NEW_PASSWORD=初始密码 npx tsx scripts/create-tms-manager-user.ts
 *
 * 示例：
 *   NEW_USERNAME=zhang NEW_PASSWORD=YourPassword123 npx tsx scripts/create-tms-manager-user.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.NEW_USERNAME?.trim()
  const password = process.env.NEW_PASSWORD?.trim()

  if (!username || !password) {
    console.error('请设置环境变量 NEW_USERNAME 和 NEW_PASSWORD')
    console.error('示例: NEW_USERNAME=zhang NEW_PASSWORD=YourPassword123 npx tsx scripts/create-tms-manager-user.ts')
    process.exit(1)
  }

  if (password.length < 6) {
    console.error('密码至少 6 个字符')
    process.exit(1)
  }

  const existing = await prisma.users.findUnique({ where: { username } })
  if (existing) {
    console.error(`用户名 "${username}" 已存在`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.users.create({
    data: {
      username,
      password_hash: passwordHash,
      full_name: username,
      role: 'tms_manager',
      status: 'active',
    },
  })

  console.log('TMS 经理账号已创建（权限与 lin 相同）')
  console.log('  ID:', user.id.toString())
  console.log('  用户名:', user.username)
  console.log('  角色: tms_manager')
  console.log('  状态: active')
  console.log('请使用上述用户名和新密码登录，登录后建议在「用户管理」中修改姓名或密码。')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
