import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // 处理根路径
  if (pathname === "/") {
    if (session?.user) {
      // 已登录用户访问根路径，重定向到 dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url))
    } else {
      // 未登录用户访问根路径，重定向到登录页
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  // 公开路由（不需要登录）
  const publicPaths = ["/login", "/api/auth"]
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  // 如果是公开路由，允许访问
  if (isPublicPath) {
    // 如果已登录用户访问登录页，重定向到仪表盘
    if (session?.user && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // 如果未登录且不是公开路由，重定向到登录页
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url)
    // 保存原始 URL，登录后可以重定向回来
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

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

