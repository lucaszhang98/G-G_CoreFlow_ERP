import { handlers } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

// 包装 handlers 以捕获错误并返回详细信息
export const GET = async (request: NextRequest) => {
  try {
    // 先检查 handlers 是否存在
    if (!handlers || !handlers.GET) {
      console.error("❌ NextAuth handlers 未初始化！")
      return NextResponse.json(
        { 
          error: "NextAuth handlers not initialized",
          message: "NextAuth handlers are undefined. Check server logs for initialization errors.",
          detail: "这通常意味着 NextAuth 初始化失败，可能是环境变量问题"
        },
        { status: 500 }
      )
    }
    
    const response = await handlers.GET(request)
    
    // 检查响应状态，如果是 500，尝试获取详细信息
    if (response.status === 500) {
      const text = await response.text()
      console.error("NextAuth GET 返回 500:", text)
      
      try {
        const json = JSON.parse(text)
        return NextResponse.json(
          {
            ...json,
            _debug: {
              hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
              hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
              nodeEnv: process.env.NODE_ENV,
            }
          },
          { status: 500 }
        )
      } catch {
        return NextResponse.json(
          {
            error: "Authentication error",
            message: text || "Unknown error from NextAuth",
            _debug: {
              hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
              hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
            }
          },
          { status: 500 }
        )
      }
    }
    
    return response
  } catch (error: any) {
    console.error("❌ NextAuth GET 异常:", error)
    console.error("错误堆栈:", error?.stack)
    
    return NextResponse.json(
      { 
        error: "Authentication error",
        message: error?.message || "Unknown error",
        type: error?.constructor?.name || "Error",
        stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
        _debug: {
          hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
          hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
          handlersExists: !!handlers,
          handlersGetExists: !!(handlers?.GET),
        }
      },
      { status: 500 }
    )
  }
}

export const POST = async (request: NextRequest) => {
  try {
    if (!handlers || !handlers.POST) {
      console.error("❌ NextAuth handlers 未初始化！")
      return NextResponse.json(
        { 
          error: "NextAuth handlers not initialized",
          message: "NextAuth handlers are undefined. Check server logs for initialization errors.",
          detail: "这通常意味着 NextAuth 初始化失败，可能是环境变量问题"
        },
        { status: 500 }
      )
    }
    
    const response = await handlers.POST(request)
    
    if (response.status === 500) {
      const text = await response.text()
      console.error("NextAuth POST 返回 500:", text)
      
      try {
        const json = JSON.parse(text)
        return NextResponse.json(
          {
            ...json,
            _debug: {
              hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
              hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
            }
          },
          { status: 500 }
        )
      } catch {
        return NextResponse.json(
          {
            error: "Authentication error",
            message: text || "Unknown error from NextAuth",
            _debug: {
              hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
              hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
            }
          },
          { status: 500 }
        )
      }
    }
    
    return response
  } catch (error: any) {
    console.error("❌ NextAuth POST 异常:", error)
    console.error("错误堆栈:", error?.stack)
    
    return NextResponse.json(
      { 
        error: "Authentication error",
        message: error?.message || "Unknown error",
        type: error?.constructor?.name || "Error",
        stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
        _debug: {
          hasSecret: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
          hasAuthUrl: !!(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
          handlersExists: !!handlers,
          handlersPostExists: !!(handlers?.POST),
        }
      },
      { status: 500 }
    )
  }
}

