/**
 * 货柜管理 API 路由 - 使用通用框架
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { trailerConfig } from '@/lib/crud/configs/trailers'

// 使用通用框架处理 GET 和 POST
const baseListHandler = createListHandler(trailerConfig)
const baseCreateHandler = createCreateHandler(trailerConfig)

/**
 * GET /api/trailers
 * 获取货柜列表
 */
export async function GET(request: NextRequest) {
  return baseListHandler(request)
}

/**
 * POST /api/trailers
 * 创建货柜
 */
export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
