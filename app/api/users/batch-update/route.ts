/**
 * 用户批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { userConfig } from '@/lib/crud/configs/users'

const batchUpdateHandler = createBatchUpdateHandler(userConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

