/**
 * 用户批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { userConfig } from '@/lib/crud/configs/users'

const batchDeleteHandler = createBatchDeleteHandler(userConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

