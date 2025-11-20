/**
 * 位置管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { locationConfig } from '@/lib/crud/configs/locations'

// 使用通用框架处理 GET 和 POST
const baseListHandler = createListHandler(locationConfig)
const baseCreateHandler = createCreateHandler(locationConfig)

/**
 * GET /api/locations
 * 获取位置列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

/**
 * POST /api/locations
 * 创建位置
 */
export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
