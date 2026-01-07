import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearQueryCache() {
  try {
    console.log('开始清除 PostgreSQL 查询计划缓存...')

    // 清除所有缓存的查询计划
    await prisma.$executeRawUnsafe(`DEALLOCATE ALL`)
    console.log('✅ 已清除所有 prepared statements')

    // 可选：清除所有会话级别的缓存
    await prisma.$executeRawUnsafe(`DISCARD ALL`)
    console.log('✅ 已清除所有会话级别的缓存')

    console.log('✅ 查询计划缓存已清除！')
    console.log('现在重启开发服务器应该就可以正常工作了')
  } catch (error) {
    console.error('❌ 清除缓存失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearQueryCache()

