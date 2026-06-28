/**
 * 多仓：当前仓库解析。
 *
 * 解析顺序：切仓 cookie → 用户默认仓(default_warehouse_id) → OAK(1000)。
 * cookie 值为 ALL_WAREHOUSES('all') 时表示「全部仓库」（不按仓过滤）。
 */
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const WAREHOUSE_COOKIE = 'cf_current_warehouse'
export const ALL_WAREHOUSES = 'all'
export const DEFAULT_WAREHOUSE_ID = BigInt(1000)

async function fetchUserHomeWarehouse(uid: string): Promise<bigint | null> {
  try {
    const u = await prisma.users.findUnique({
      where: { id: BigInt(uid) },
      select: { default_warehouse_id: true },
    })
    return u?.default_warehouse_id ?? null
  } catch {
    return null
  }
}

/**
 * 解析当前仓库 id。
 * - admin：cookie 选择 → 默认仓 → OAK；可选 'all'（全部仓库）。
 * - 非 admin：强制锁定在自己归属仓库（忽略 cookie / all），保证数据隔离。
 * @returns bigint = 指定仓库；null = 全部仓库（仅 admin）
 */
export async function resolveCurrentWarehouseId(): Promise<bigint | null> {
  const session = await auth().catch(() => null)
  const uid = session?.user?.id
  const role = session?.user?.role

  // 非 admin：锁定归属仓库，不受 cookie 影响
  if (role !== 'admin') {
    if (uid) {
      const home = await fetchUserHomeWarehouse(uid)
      if (home != null) return home
    }
    return DEFAULT_WAREHOUSE_ID
  }

  // admin：cookie → 默认仓 → OAK
  const store = await cookies()
  const raw = store.get(WAREHOUSE_COOKIE)?.value
  if (raw === ALL_WAREHOUSES) return null
  if (raw && /^\d+$/.test(raw)) return BigInt(raw)
  if (uid) {
    const home = await fetchUserHomeWarehouse(uid)
    if (home != null) return home
  }
  return DEFAULT_WAREHOUSE_ID
}

/**
 * 直接带 warehouse_id 列的表用：返回可直接展开进 where 的过滤片段。
 * 全部仓库时返回空对象（不过滤）。
 */
export function warehouseWhere(
  warehouseId: bigint | null
): { warehouse_id?: bigint } {
  return warehouseId == null ? {} : { warehouse_id: warehouseId }
}

/**
 * 经 orders 关联的表用：按关联订单的仓库过滤。
 * 全部仓库时返回空对象（不过滤）。
 */
export function ordersWarehouseWhere(
  warehouseId: bigint | null,
  ordersRelationKey = 'orders'
): Record<string, unknown> {
  if (warehouseId == null) return {}
  return { [ordersRelationKey]: { warehouse_id: warehouseId } }
}
