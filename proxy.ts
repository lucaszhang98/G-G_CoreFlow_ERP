import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // 对于 /api/auth 路由，直接放行，不进行任何处理
  // 这些路由由 NextAuth 自己处理
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }
  
  try {
    // NextAuth 5.0: auth() 在 proxy 中可以直接调用，会自动从请求上下文获取
    const session = await auth()
    
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
    const publicPaths = ["/login"]
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
  } catch (error) {
    // 如果认证检查失败，记录错误但允许继续（避免阻止所有请求）
    console.error('[Proxy] Auth error:', error)
    // 对于公开路由，即使认证失败也允许访问
    const publicPaths = ["/login", "/api/auth"]
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))
    
    if (isPublicPath) {
      return NextResponse.next()
    }
    
    // 对于受保护的路由，如果认证失败，重定向到登录页
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }
}

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
