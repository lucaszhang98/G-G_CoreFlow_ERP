import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 诊断日志：检查环境变量配置
if (process.env.NODE_ENV === 'production') {
  console.log('[Prisma Config] DATABASE_URL exists:', !!process.env.DATABASE_URL)
  console.log('[Prisma Config] DIRECT_URL exists:', !!process.env.DIRECT_URL)
  console.log('[Prisma Config] DATABASE_URL has -pooler:', process.env.DATABASE_URL?.includes('-pooler'))
  console.log('[Prisma Config] DIRECT_URL has -pooler:', process.env.DIRECT_URL?.includes('-pooler'))
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

