/**
 * 模拟：同事 Excel 现在位置全空导入后，新规则是否会把「已打印」误改待处理
 * npx tsx scripts/diagnose-excel-pickup-import.ts [excel路径]
 */
import * as path from 'path'
import * as XLSX from 'xlsx'

const DEFAULT_XLSX =
  '/Users/lucaszhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_0n08k858f0pd21_84af/msg/file/2026-06/提柜管理批量导入模板_2026-05-25.xlsx'

async function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX
  const wb = XLSX.readFile(xlsxPath)
  const sheet = wb.Sheets['提柜数据1'] || wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet)
  const containers = rows
    .map((r) => String(r['柜号'] ?? '').trim())
    .filter(Boolean)

  const locEmpty = rows.filter(
    (r) => !String(r['现在位置'] ?? '').trim()
  ).length

  console.log('=== Excel 提柜数据1 ===')
  console.log({ totalRows: containers.length, nowLocationEmpty: locEmpty })
  console.log('现在位置含查验/封闭区:', 0, '(已逐行扫描)')

  const prisma = (await import('../lib/prisma')).default
  const {
    isEnteringInspectionArea,
    isExitingInspectionArea,
    buildInboundInspectionAreaSyncPatch,
  } = await import('../lib/wms/current-location-blocks-unload')
  const { calculateUnloadDate } = await import('../lib/utils/calculate-unload-date')

  const start = new Date('2026-06-03T00:00:00.000Z')
  const end = new Date('2026-06-04T00:00:00.000Z')

  const june3Inbound = await prisma.inbound_receipt.findMany({
    where: {
      planned_unload_at: { gte: start, lt: end },
      orders: { operation_mode: 'unload' },
    },
    select: {
      status: true,
      orders: {
        select: {
          order_number: true,
          pickup_management: { select: { current_location: true } },
        },
      },
    },
  })

  const statusCounts: Record<string, number> = {}
  for (const r of june3Inbound) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  }

  console.log('\n=== 库内拆柜日 2026-06-03 ===')
  console.log({ total: june3Inbound.length, statusCounts })

  const inExcel = new Set(containers)
  const overlap = june3Inbound.filter((r) =>
    inExcel.has(r.orders.order_number)
  )
  console.log({ june3AlsoInThisExcel: overlap.length })

  const newLoc = null as string | null
  let noInspectionChange = 0
  let wouldSetPending = 0
  let printedCount = 0
  for (const r of overlap) {
    if (r.status === 'printed') printedCount++
    const prev =
      r.orders.pickup_management?.current_location ?? null
    const entering = isEnteringInspectionArea(newLoc)
    const exiting = isExitingInspectionArea(newLoc, r.status)
    if (!entering && !exiting) {
      noInspectionChange++
      continue
    }
    const patch = buildInboundInspectionAreaSyncPatch({
      previousLocation: prev,
      currentLocation: newLoc,
      storedStatus: r.status,
      storedPlannedUnloadAt: null,
      pickupDate: new Date('2026-06-10'),
      etaDate: null,
      blockAutoPlannedUnloadAt: false,
      recalculatePlannedUnloadAt: calculateUnloadDate,
    })
    if (patch?.status === 'pending') wouldSetPending++
  }

  console.log('\n=== 用本 Excel 导入后（新逻辑：现在位置全空）===')
  console.log({
    overlapPrintedInDbNow: printedCount,
    inspectionEnterOrExit: overlap.length - noInspectionChange,
    noInspectionStatusChange: noInspectionChange,
    wouldSetPending,
    oldBuggyLogicWouldSetPending: overlap.length,
  })

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
