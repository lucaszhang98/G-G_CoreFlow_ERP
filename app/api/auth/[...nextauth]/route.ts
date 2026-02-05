import { handlers } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const { GET: authGet, POST: authPost } = handlers

async function withAuthErrorHandling(
  handler: (req: NextRequest) => Promise<Response>,
  request: NextRequest
): Promise<Response> {
  try {
    return await handler(request)
  } catch (error) {
    console.error('[NextAuth] error:', error)
    return NextResponse.json(
      { error: 'Authentication error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withAuthErrorHandling(authGet, request)
}

export async function POST(request: NextRequest) {
  return withAuthErrorHandling(authPost, request)
}

