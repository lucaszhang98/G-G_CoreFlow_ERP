import { handlers } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

export const { GET, POST } = handlers

// 添加错误处理（如果需要）
export async function GET_WITH_ERROR_HANDLING(request: NextRequest) {
  try {
    return await GET(request)
  } catch (error) {
    console.error('[NextAuth] GET error:', error)
    return NextResponse.json(
      { error: 'Authentication error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST_WITH_ERROR_HANDLING(request: NextRequest) {
  try {
    return await POST(request)
  } catch (error) {
    console.error('[NextAuth] POST error:', error)
    return NextResponse.json(
      { error: 'Authentication error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

