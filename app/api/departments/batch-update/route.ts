/**
 * 部门批量更新 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchUpdateHandler } from '@/lib/crud/api-handler'
import { departmentConfig } from '@/lib/crud/configs/departments'

const batchUpdateHandler = createBatchUpdateHandler(departmentConfig)

export async function POST(request: NextRequest) {
  return batchUpdateHandler(request)
}

