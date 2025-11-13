import prisma from "../lib/prisma"
import bcrypt from "bcryptjs"

async function createTestUser() {
  try {
    const username = "admin"
    const password = "admin123"
    const email = "admin@example.com"
    const hashedPassword = await bcrypt.hash(password, 10)

    // 检查用户是否已存在
    const existingUser = await prisma.users.findUnique({
      where: { username },
    })

    if (existingUser) {
      console.log("用户已存在，更新密码...")
      await prisma.users.update({
        where: { username },
        data: {
          password_hash: hashedPassword,
          status: "active",
        },
      })
      console.log(`✅ 用户密码已更新`)
      console.log(`   用户名: ${username}`)
      console.log(`   密码: ${password}`)
    } else {
      const user = await prisma.users.create({
        data: {
          username,
          email,
          password_hash: hashedPassword,
          full_name: "管理员",
          role: "admin",
          status: "active",
        },
      })
      console.log("✅ 测试用户创建成功")
      console.log(`   用户名: ${username}`)
      console.log(`   密码: ${password}`)
      console.log(`   ID: ${user.id}`)
    }
  } catch (error) {
    console.error("❌ 创建用户失败:", error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()

