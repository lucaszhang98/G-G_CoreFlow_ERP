import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/api/middleware'
import {
  WAREHOUSE_COOKIE,
  ALL_WAREHOUSES,
  DEFAULT_WAREHOUSE_ID,
  canSwitchWarehouse,
  resolveCurrentWarehouseId,
} from '@/lib/warehouse/current-warehouse'

/**
 * GET /api/warehouse/current
 * 返回当前选中的仓库 + 仓库列表（仅用户名 admin 可切换，故列表也仅 admin 有意义）
 */
export async function GET() {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  const canSwitch = canSwitchWarehouse(authResult.user?.username)
  const current = await resolveCurrentWarehouseId()
  const warehouses = canSwitch
    ? await prisma.warehouses.findMany({
        select: { warehouse_id: true, warehouse_code: true, name: true },
        orderBy: { warehouse_id: 'asc' },
      })
    : []

  return NextResponse.json({
    isAdmin: canSwitch,
    canSwitchWarehouse: canSwitch,
    currentWarehouseId: current == null ? ALL_WAREHOUSES : String(current),
    isAll: current == null,
    defaultWarehouseId: String(DEFAULT_WAREHOUSE_ID),
    isDefaultWarehouse: current != null && current === DEFAULT_WAREHOUSE_ID,
    warehouses: warehouses.map((w) => ({
      warehouse_id: String(w.warehouse_id),
      warehouse_code: w.warehouse_code,
      name: w.name,
    })),
  })
}

/**
 * POST /api/warehouse/current  { warehouse_id: string | 'all' }
 * 设置当前仓库 cookie（仅用户名 admin；其他账号锁定本仓）
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  if (!canSwitchWarehouse(authResult.user?.username)) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const value = String(body?.warehouse_id ?? '').trim()

  let cookieValue: string
  if (value === ALL_WAREHOUSES) {
    cookieValue = ALL_WAREHOUSES
  } else if (/^\d+$/.test(value)) {
    const exists = await prisma.warehouses.findUnique({
      where: { warehouse_id: BigInt(value) },
      select: { warehouse_id: true },
    })
    if (!exists) {
      return NextResponse.json({ error: '仓库不存在' }, { status: 400 })
    }
    cookieValue = value
  } else {
    return NextResponse.json({ error: '无效的仓库参数' }, { status: 400 })
  }

  const store = await cookies()
  store.set(WAREHOUSE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })

  return NextResponse.json({ success: true, currentWarehouseId: cookieValue })
}
