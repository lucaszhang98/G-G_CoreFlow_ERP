import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, serializeBigInt } from '@/lib/api/helpers'
import prisma from '@/lib/prisma'

/**
 * GET - 根据 location_code 查询位置（返回 location_id 供表单使用）
 * Query params: code - 位置编码，如 SZ1、GG
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim()
    if (!code) {
      return NextResponse.json({ error: '缺少 code 参数' }, { status: 400 })
    }

    const location = await prisma.locations.findFirst({
      where: {
        location_code: { equals: code, mode: 'insensitive' },
      },
      select: {
        location_id: true,
        location_code: true,
        name: true,
        location_type: true,
      },
    })

    if (!location) {
      return NextResponse.json({ data: null })
    }

    const serialized = serializeBigInt(location)
    return NextResponse.json({ data: serialized })
  } catch (error: any) {
    console.error('根据 code 查询位置失败:', error)
    return NextResponse.json(
      { error: '查询位置失败' },
      { status: 500 }
    )
  }
}
