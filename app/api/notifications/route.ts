import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/api/helpers'

export async function GET(_request: NextRequest) {
  const authResult = await checkAuth()
  if (authResult.error) return authResult.error

  return NextResponse.json({
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  })
}

