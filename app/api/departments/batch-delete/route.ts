/**
 * 部门批量删除 API 路由 - 使用通用框架
 */

import { NextRequest } from 'next/server'
import { createBatchDeleteHandler } from '@/lib/crud/api-handler'
import { departmentConfig } from '@/lib/crud/configs/departments'

const batchDeleteHandler = createBatchDeleteHandler(departmentConfig)

export async function POST(request: NextRequest) {
  return batchDeleteHandler(request)
}

