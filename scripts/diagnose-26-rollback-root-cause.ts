/**
 * 定位 26 条在途 + 已打印 导入后 23 条变 pending 的根因
 * npx tsx scripts/diagnose-26-rollback-root-cause.ts [excel路径]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const XLSX_PATH =
  process.argv[2] ||
  '/Users/lucaszhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_0n08k858f0pd21_84af/msg/file/2026-06/提柜管理批量导入模板_2026-05-25.xlsx'

const PLANNED = '2026-06-03'

async function main() {
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' })
  const sheet = wb.Sheets['提柜数据1'] || wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet)
  const excelByCn = new Map<string, { hasPickupDate: boolean; hasEta: boolean }>()
  for (const r of rows) {
    const cn = String(r['柜号'] ?? '').trim()
    if (!cn) continue
    const pickup = r['提柜日期']
    const eta = r['ETA']
    excelByCn.set(cn, {
      hasPickupDate: pickup != null && String(pickup).trim() !== '',
      hasEta: eta != null && String(eta).trim() !== '',
    })
  }

  const prisma = (await import('../lib/prisma')).default
  const { ordersWhereOperational } = await import('../lib/orders/operational-order-lookup')
  const {
    buildInboundInspectionAreaSyncPatch,
    buildNormalPlannedUnloadSyncPatch,
  } = await import('../lib/wms/current-location-blocks-unload')
  const { calculateUnloadDate } = await import('../lib/utils/calculate-unload-date')

  const dayStart = new Date(`${PLANNED}T00:00:00.000Z`)
  const dayEnd = new Date('2026-06-04T00:00:00.000Z')

  const inbound = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: dayStart, lt: dayEnd },
      orders: {
        operation_mode: 'unload',
        ...ordersWhereOperational(),
      },
    },
    select: {
      inbound_receipt_id: true,
      status: true,
      planned_unload_at: true,
      updated_at: true,
      orders: {
        select: {
          order_number: true,
          order_id: true,
          status: true,
          pickup_date: true,
          eta_date: true,
          pickup_management: {
            select: { current_location: true, updated_at: true },
          },
        },
      },
    },
  })

  console.log('在途拆柜日', PLANNED, '入库单数:', inbound.length)

  let syncCallCount = 0
  let patchPending = 0
  let patchOnlyDate = 0
  let patchNone = 0
  let notInExcel = 0
  let noSyncTrigger = 0

  const pendingNow: string[] = []
  const printedNow: string[] = []

  for (const r of inbound) {
    const cn = r.orders.order_number
    if (r.status === 'pending') pendingNow.push(cn)
    if (r.status === 'printed') printedNow.push(cn)

    const ex = excelByCn.get(cn)
    if (!ex) {
      notInExcel++
      continue
    }

    const prevLoc = r.orders.pickup_management?.current_location ?? null
    const newLoc = null as string | null
    const locationUnchanged = (prevLoc ?? null) === newLoc
    const pickupDateInExcel = ex.hasPickupDate
    const pickupWasUpdated = !locationUnchanged
    const wouldCallSync =
      pickupWasUpdated || pickupDateInExcel || ex.hasEta

    if (!wouldCallSync) {
      noSyncTrigger++
      continue
    }
    syncCallCount++

    // 模拟导入前用户已批量设为 printed
    const storedBeforeImport = 'printed' as const
    const inspectionPatch = buildInboundInspectionAreaSyncPatch({
      previousLocation: prevLoc,
      currentLocation: newLoc,
      storedStatus: storedBeforeImport,
      storedPlannedUnloadAt: r.planned_unload_at,
      pickupDate: r.orders.pickup_date,
      etaDate: r.orders.eta_date,
      blockAutoPlannedUnloadAt: false,
      recalculatePlannedUnloadAt: calculateUnloadDate,
    })
    let patch = inspectionPatch
    if (!patch && pickupDateInExcel) {
      patch = buildNormalPlannedUnloadSyncPatch({
        storedPlannedUnloadAt: r.planned_unload_at,
        pickupDate: r.orders.pickup_date,
        etaDate: r.orders.eta_date,
        blockAutoPlannedUnloadAt: false,
        recalculatePlannedUnloadAt: calculateUnloadDate,
      })
    }
    if (patch?.status === 'pending') patchPending++
    else if (patch && !patch.status) patchOnlyDate++
    else patchNone++
  }

  console.log('\n=== 当前库内状态 ===')
  console.log({ pending: pendingNow.length, printed: printedNow.length })
  console.log('仍为 printed:', printedNow)

  console.log('\n=== 假设导入前全部为 printed（当前代码）===')
  console.log({
    inExcel: inbound.length - notInExcel,
    notInExcel,
    syncCallCount,
    noSyncTrigger,
    patchWouldSetPending: patchPending,
    patchOnlyPlannedUnload: patchOnlyDate,
    patchNone,
  })

  // 模拟 4362610 旧 sync：无关键词 => 一律 pending
  let legacyPending = 0
  for (const r of inbound) {
    const ex = excelByCn.get(r.orders.order_number)
    if (!ex) continue
    const wouldCallSync =
      (r.orders.pickup_management?.current_location ?? null) !== null ||
      ex.hasPickupDate ||
      ex.hasEta
    if (!wouldCallSync) continue
    legacyPending++
  }
  console.log('\n=== 若线上仍是 4362610 旧逻辑（每次 sync 写 pending）===')
  console.log({ wouldOverwriteToPending: legacyPending })

  // 导入前库内若是 inspection 会怎样
  let exitFromInspection = 0
  for (const r of inbound) {
    const ex = excelByCn.get(r.orders.order_number)
    if (!ex) continue
    const patch = buildInboundInspectionAreaSyncPatch({
      previousLocation: r.orders.pickup_management?.current_location ?? null,
      currentLocation: null,
      storedStatus: 'inspection',
      storedPlannedUnloadAt: r.planned_unload_at,
      pickupDate: r.orders.pickup_date,
      etaDate: r.orders.eta_date,
      blockAutoPlannedUnloadAt: false,
      recalculatePlannedUnloadAt: calculateUnloadDate,
    })
    if (patch?.status === 'pending') exitFromInspection++
  }
  console.log('\n=== 若导入前库内实为 inspection（非 printed）===')
  console.log({ wouldExitToPending: exitFromInspection })

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
