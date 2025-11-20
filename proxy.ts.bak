import { auth } from "@/auth"
import { NextResponse } from "next/server"

// Next.js 16 使用 proxy.ts 替代 middleware.ts
// NextAuth.js v5 的 auth() 函数返回的 middleware 可以直接作为 proxy 使用
// 确保使用 Node.js 运行时，不使用 Edge Runtime（避免 Prisma 原生模块问题）
export const runtime = 'nodejs'

export default auth((req) => {
  // NextAuth.js v5 的 authorized callback 已经处理了路由保护
  // proxy 只需要调用 auth 函数即可
  // 授权逻辑在 auth.config.ts 的 authorized callback 中处理
  return NextResponse.next()
})

export const config = {
  // 匹配所有路由，除了静态资源和 Next.js 内部文件
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}

