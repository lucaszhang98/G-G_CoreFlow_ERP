/**
 * 部门管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { departmentConfig } from '@/lib/crud/configs/departments'

// 使用通用框架处理 GET 和 POST
const baseListHandler = createListHandler(departmentConfig)
const baseCreateHandler = createCreateHandler(departmentConfig)

/**
 * GET /api/departments
 * 获取部门列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

/**
 * POST /api/departments
 * 创建部门
 */
export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
