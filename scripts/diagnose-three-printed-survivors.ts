/**
 * 对比：导入后仍为已打印的 3 个柜 vs 回滚为待处理的柜
 * npx tsx scripts/diagnose-three-printed-survivors.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SURVIVORS = ['EGSU6231214', 'FFAU7079247', 'EGHU8412012']
const PLANNED_DAY = '2026-06-03'

async function main() {
  const prisma = (await import('../lib/prisma')).default
  const {
    isExitingInspectionArea,
    isEnteringInspectionArea,
    buildInboundInspectionAreaSyncPatch,
    currentLocationBlocksPlannedUnload,
  } = await import('../lib/wms/current-location-blocks-unload')
  const { calculateUnloadDate } = await import('../lib/utils/calculate-unload-date')

  const dayStart = new Date(`${PLANNED_DAY}T00:00:00.000Z`)
  const dayEnd = new Date('2026-06-04T00:00:00.000Z')

  const rows = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: dayStart, lt: dayEnd },
      orders: { operation_mode: 'unload' },
    },
    select: {
      inbound_receipt_id: true,
      status: true,
      planned_unload_at: true,
      updated_at: true,
      unloaded_by: true,
      orders: {
        select: {
          order_id: true,
          order_number: true,
          pickup_date: true,
          eta_date: true,
          pickup_management: {
            select: {
              pickup_id: true,
              current_location: true,
              updated_at: true,
            },
          },
        },
      },
    },
    orderBy: { orders: { order_number: 'asc' } },
  })

  const byStatus: Record<string, string[]> = {}
  for (const r of rows) {
    const cn = r.orders.order_number
    if (!byStatus[r.status]) byStatus[r.status] = []
    byStatus[r.status].push(cn)
  }

  console.log('=== 2026-06-03 入库单 ===')
  console.log({
    total: rows.length,
    printed: byStatus.printed?.length ?? 0,
    pending: byStatus.pending?.length ?? 0,
    other: Object.fromEntries(
      Object.entries(byStatus).filter(([k]) => k !== 'printed' && k !== 'pending')
    ),
  })

  console.log('\n=== 仍为已打印（幸存者）===')
  for (const cn of SURVIVORS) {
    const r = rows.find((x) => x.orders.order_number === cn)
    if (!r) {
      console.log(cn, 'NOT IN june-3 set')
      continue
    }
    const pm = r.orders.pickup_management
    console.log({
      container: cn,
      status: r.status,
      inbound_updated_at: r.updated_at,
      pickup_id: pm?.pickup_id?.toString() ?? null,
      pickup_updated_at: pm?.updated_at ?? null,
      current_location: pm?.current_location,
      pickup_date: r.orders.pickup_date,
      has_pickup_row: Boolean(pm),
    })
  }

  console.log('\n=== 幸存者 vs 待处理：结构性差异 ===')
  const survivors = rows.filter((r) => SURVIVORS.includes(r.orders.order_number))
  const pending = rows.filter((r) => r.status === 'pending')

  const count = (arr: typeof rows, pred: (r: (typeof rows)[0]) => boolean) =>
    arr.filter(pred).length

  const stats = (label: string, arr: typeof rows) => ({
    label,
    n: arr.length,
    no_pickup_management: count(arr, (r) => !r.orders.pickup_management),
    pickup_null_location: count(
      arr,
      (r) => r.orders.pickup_management?.current_location == null
    ),
    pickup_has_keywords: count(arr, (r) =>
      currentLocationBlocksPlannedUnload(
        r.orders.pickup_management?.current_location
      )
    ),
  })

  console.log(stats('survivors_printed', survivors))
  console.log(stats('pending_after_import', pending.slice(0, 26)))

  // 模拟 Excel 导入：现在位置 null，previous = 库内现在位置
  console.log('\n=== 模拟导入同步补丁（新位置=null）===')
  let exitPatch = 0
  let enterPatch = 0
  let noPatch = 0
  for (const r of rows) {
    const prev = r.orders.pickup_management?.current_location ?? null
    const patch = buildInboundInspectionAreaSyncPatch({
      previousLocation: prev,
      currentLocation: null,
      storedStatus: r.status === 'printed' ? 'printed' : r.status,
      storedPlannedUnloadAt: r.planned_unload_at,
      pickupDate: r.orders.pickup_date,
      etaDate: r.orders.eta_date,
      blockAutoPlannedUnloadAt: false,
      recalculatePlannedUnloadAt: calculateUnloadDate,
    })
    if (patch?.status === 'pending') exitPatch++
    else if (patch?.status === 'inspection' || patch?.status === 'closed_area')
      enterPatch++
    else noPatch++
  }
  console.log({ exitWouldSetPending: exitPatch, enterPatch, noPatch })

  // 关键：若导入前库内曾是 printed，模拟旧逻辑（仅 stored inspection 即放出）
  console.log('\n=== 若导入前全是 printed，旧逻辑误放出（prev无关键词也退出）===')
  let oldBug = 0
  for (const r of rows) {
    const prev = r.orders.pickup_management?.current_location ?? null
    const storedBeforeImport = 'printed' as const
    if (
      !currentLocationBlocksPlannedUnload(null) &&
      (storedBeforeImport === 'inspection' ||
        storedBeforeImport === 'closed_area')
    ) {
      oldBug++
    }
    // 实际旧版 isExiting 仅看 stored inspection + new null
    const { inboundStatusBlocksUnload } = await import(
      '../lib/wms/current-location-blocks-unload'
    )
    if (
      inboundStatusBlocksUnload(storedBeforeImport) &&
      !isEnteringInspectionArea(null)
    ) {
      oldBug++
    }
  }
  console.log({ oldLogicWouldTouchPrinted: oldBug })

  // 查 26 条是否都有 pickup_management
  const printed = rows.filter((r) => r.status === 'printed')
  const pendingOnly = rows.filter((r) => r.status === 'pending')
  console.log('\n=== 当前 printed 柜号 ===', printed.map((r) => r.orders.order_number))
  console.log(
    'pending 中有 pickup 记录:',
    pendingOnly.filter((r) => r.orders.pickup_management).length,
    '/',
    pendingOnly.length
  )
  console.log(
    'printed 中有 pickup 记录:',
    printed.filter((r) => r.orders.pickup_management).length,
    '/',
    printed.length
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
