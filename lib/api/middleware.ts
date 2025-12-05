/**
 * API 中间件 - 统一处理请求和响应
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * 请求日志中间件
 */
export function logRequest(request: NextRequest, handler: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${request.method} ${request.nextUrl.pathname} - ${handler}`)
  }
}

/**
 * 错误处理中间件
 */
export function handleApiError(error: any, defaultMessage: string = '操作失败') {
  console.error('[API Error]', {
    message: error?.message,
    code: error?.code,
    stack: error?.stack,
  })

  // Prisma 错误处理
  if (error?.code === 'P2002') {
    return NextResponse.json(
      { error: '数据已存在，请检查唯一性约束' },
      { status: 409 }
    )
  }

  if (error?.code === 'P2025') {
    return NextResponse.json(
      { error: '记录不存在' },
      { status: 404 }
    )
  }

  if (error?.code === 'P2003') {
    return NextResponse.json(
      { error: '有关联数据，无法删除' },
      { status: 409 }
    )
  }

  // 默认错误
  return NextResponse.json(
    { error: error?.message || defaultMessage },
    { status: 500 }
  )
}

/**
 * 认证检查中间件
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      ),
      user: null,
    }
  }
  return {
    error: null,
    user: session.user,
  }
}

/**
 * 权限检查中间件
 */
export async function requirePermission(allowedRoles: string[]) {
  const authResult = await requireAuth()
  if (authResult.error) {
    return authResult
  }

  const user = authResult.user
  if (!user?.role || !allowedRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      ),
      user: null,
    }
  }

  return {
    error: null,
    user,
  }
}

/**
 * API 包装器 - 统一处理错误和日志
 */
export function withApiHandler<T = any>(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse<T>>,
  handlerName: string = 'Unknown'
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse<T | { error: string }>> => {
    try {
      logRequest(request, handlerName)
      return await handler(request, ...args)
    } catch (error: any) {
      return handleApiError(error, `${handlerName}失败`) as NextResponse<T | { error: string }>
    }
  }
}

/**
 * 参数解析中间件（处理 Next.js 15 的 Promise params）
 */
export async function resolveParams<T extends Record<string, string>>(
  params: Promise<T> | T
): Promise<T> {
  return params instanceof Promise ? await params : params
}

/**
 * 请求体解析中间件
 */
export async function parseBody<T = any>(request: NextRequest): Promise<T> {
  try {
    return await request.json()
  } catch (error) {
    throw new Error('无效的 JSON 请求体')
  }
}

/**
 * 响应包装器 - 统一响应格式
 */
export function successResponse<T>(data: T, message?: string, status: number = 200) {
  const response: any = { data }
  if (message) {
    response.message = message
  }
  return NextResponse.json(response, { status })
}

/**
 * 错误响应包装器
 */
export function errorResponse(message: string, status: number = 400, details?: any) {
  const response: any = { error: message }
  if (details) {
    response.details = details
  }
  return NextResponse.json(response, { status })
}

