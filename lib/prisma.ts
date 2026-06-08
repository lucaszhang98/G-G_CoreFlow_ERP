import { PrismaClient } from '@prisma/client'

/** schema 变更时递增，迫使 dev 环境丢弃缓存的旧 PrismaClient */
const PRISMA_CLIENT_SCHEMA_REV = 2

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaRev?: number
}

// 诊断日志：检查环境变量配置
if (process.env.NODE_ENV === 'production') {
  console.log('[Prisma Config] DATABASE_URL exists:', !!process.env.DATABASE_URL)
  console.log('[Prisma Config] DIRECT_URL exists:', !!process.env.DIRECT_URL)
  console.log('[Prisma Config] DATABASE_URL has -pooler:', process.env.DATABASE_URL?.includes('-pooler'))
  console.log('[Prisma Config] DIRECT_URL has -pooler:', process.env.DIRECT_URL?.includes('-pooler'))
}

function createPrismaClient() {
  return new PrismaClient()
}

const cachedRev = globalForPrisma.prismaSchemaRev
const cacheValid =
  globalForPrisma.prisma &&
  cachedRev === PRISMA_CLIENT_SCHEMA_REV &&
  'mail_container_forecast' in globalForPrisma.prisma

let prisma = cacheValid ? globalForPrisma.prisma! : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaRev = PRISMA_CLIENT_SCHEMA_REV
}

export default prisma
