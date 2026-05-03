/**
 * 拆柜订单与拆柜账单（invoice_type=unload）1:1：按费用表 + 订单明细生成账单明细（不写 fee_id，仅存快照）。
 * - 订单非拆柜：删除对应拆柜账单。
 * - 订单已取消：删除对应拆柜账单。
 *
 * 计费规则摘要：
 * - 每条订单明细一条主费用行：默认「亚马逊组合柜-*」费用（fee_name 与仓点编码/名称匹配）× 分仓占比；
 *   分仓占比：优先 `order_detail.volume_percentage`；若为空则按各明细 **volume 占全单合计体积** 重算（与订单详情页展示规则一致），避免历史数据未回写字段时账单为 0%。
 *   例外：私仓，或仓点为 PDX7/BFI3/GEG2 且预计板数<5 →「提拆一口价 / terminal pick up」类费用 × 分仓占比。
 * - 拦截费：性质为「扣货」的明细条数 × 拦截费单价，合并一条明细。
 * - 超箱费：全订单明细 quantity 之和 > 1400 时，超出箱数 × 超箱费单价，一条明细。
 * - 仓点费：明细条数 > 10 时，超出条数 × 仓点费单价，一条明细。
 * - 车架费：每单固定 1 条，备注「拆柜包四天」；单价从费用表匹配（fee_code 含 chassis 或名称含「车架」等）。
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getNextContainerUnloadInvoiceNumber } from '@/lib/finance/next-container-unload-invoice-number'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import {
  downgradeAuditedInvoiceAfterLineMutation,
  getReceivableWithdrawBlockReason,
} from '@/lib/finance/invoice-receivable-sync'
import { isOrderCancelledStatus } from '@/lib/orders/order-visibility'
import { feeMatchesContainer } from '@/lib/finance/fee-matching'
import { volumePercentageFromVolumesByDetailId } from '@/lib/finance/order-detail-volume-percentage'

const BOX_THRESHOLD = 1400
/** 仓点为这些编码且预计板数 < 5 时用 terminal pick up（与私仓规则并列） */
const TERMINAL_SMALL_PALLET_LOCATION_CODES = new Set(['PDX7', 'BFI3', 'GEG2'])

function normCode(code: string) {
  return code.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function locationMatchesFeeName(
  feeName: string,
  loc: { name: string | null; location_code: string | null } | null
) {
  if (!loc) return false
  const f = feeName.trim().toLowerCase()
  if (loc.name && f === loc.name.trim().toLowerCase()) return true
  if (loc.location_code && f === loc.location_code.trim().toLowerCase()) return true
  return false
}

function getLocationDisplayCode(loc: {
  name: string | null
  location_code: string | null
} | null): string {
  if (!loc) return ''
  return (loc.location_code?.trim() || loc.name?.trim() || '').toUpperCase()
}

function usesTerminalPickUpForDetail(
  detail: { delivery_nature: string | null; estimated_pallets: number | null },
  loc: { name: string | null; location_code: string | null } | null
): boolean {
  if (detail.delivery_nature === '私仓') return true
  const code = getLocationDisplayCode(loc)
  if (!code) return false
  if (!TERMINAL_SMALL_PALLET_LOCATION_CODES.has(code)) return false
  // 业务约定：仅当「预计板数已录入且 < 5」才走提拆一口价；未录入则仍按亚马逊组合柜匹配
  const p = detail.estimated_pallets
  if (p == null) return false
  return p < 5
}

function scoreFee(
  f: {
    customer_id: bigint | null
    container_type: string | null
    fee_scope?: { customer_id: bigint }[]
  },
  order: { container_type: string | null },
  orderCustomerId: bigint
) {
  let s = 0
  if (f.customer_id != null) s += 10
  if (f.fee_scope?.some((x) => x.customer_id === orderCustomerId)) s += 8
  if (
    feeMatchesContainer(f.container_type, order.container_type) &&
    f.container_type?.trim()
  )
    s += 5
  else if (!f.container_type?.trim()) s += 1
  return s
}

async function loadApplicableFeesForCustomer(customerId: bigint) {
  return prisma.fee.findMany({
    where: {
      OR: [
        { customer_id: customerId },
        { scope_type: 'all' },
        { fee_scope: { some: { customer_id: customerId } } },
      ],
    },
    include: { fee_scope: { select: { customer_id: true } } },
  })
}

function pickBest(
  candidates: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

function isAmazonComboFee(f: { fee_code: string }) {
  return f.fee_code.trim().startsWith('亚马逊组合柜')
}

function pickAmazonComboFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint,
  loc: { name: string | null; location_code: string | null } | null
) {
  const candidates = fees.filter(
    (f) =>
      isAmazonComboFee(f) &&
      locationMatchesFeeName(f.fee_name, loc) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

/** 仓点与 fee_name 无精确行时：仍取客户+柜型下任意一条亚马逊组合柜，避免单价长期为 0（需在费用表维护各仓点行后仍以精确匹配优先）。 */
function pickAmazonComboFeeFallback(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter(
    (f) => isAmazonComboFee(f) && feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

function isTerminalPickUpFee(f: { fee_code: string; fee_name: string }) {
  const code = normCode(f.fee_code)
  const name = f.fee_name
  if (name.includes('提拆一口价')) return true
  if (name.includes('提拆') && name.includes('一口价')) return true
  if (code.includes('terminal') && code.includes('pick')) return true
  if (name.toLowerCase().includes('terminal') && name.toLowerCase().includes('pick'))
    return true
  return false
}

function pickTerminalPickUpFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter(
    (f) =>
      isTerminalPickUpFee(f) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

function isInterceptFee(f: { fee_code: string; fee_name: string }) {
  return f.fee_code.includes('拦截') || f.fee_name.includes('拦截')
}

function pickInterceptFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter(
    (f) =>
      isInterceptFee(f) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

function isOverBoxFee(f: { fee_code: string; fee_name: string }) {
  return f.fee_code.includes('超箱') || f.fee_name.includes('超箱')
}

function pickOverBoxFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter(
    (f) =>
      isOverBoxFee(f) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

function isWarehousePointFee(f: { fee_code: string; fee_name: string }) {
  return f.fee_code.includes('仓点') || f.fee_name.includes('仓点')
}

function pickWarehousePointFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter(
    (f) =>
      isWarehousePointFee(f) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  return pickBest(candidates, order, customerId)
}

function isChassisFeeRecord(f: { fee_code: string; fee_name: string }) {
  const code = normCode(f.fee_code)
  const name = (f.fee_name || '').trim().toLowerCase()
  if (code.includes('chassis')) return true
  if (name.includes('chassis')) return true
  if (f.fee_code.includes('车架') || (f.fee_name && f.fee_name.includes('车架'))) return true
  return false
}

function pickChassisFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const withContainer = fees.filter(
    (f) =>
      isChassisFeeRecord(f) &&
      feeMatchesContainer(f.container_type, order.container_type)
  )
  const pool =
    withContainer.length > 0
      ? withContainer
      : fees.filter((f) => isChassisFeeRecord(f) && !f.container_type?.trim())
  const finalPool = pool.length > 0 ? pool : fees.filter((f) => isChassisFeeRecord(f))
  if (finalPool.length === 0) return null
  return [...finalPool].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

async function deleteUnloadInvoiceByOrderId(orderId: bigint): Promise<void> {
  const existing = await prisma.invoices.findFirst({
    where: { order_id: orderId, invoice_type: 'unload' },
    select: { invoice_id: true },
  })
  if (!existing) return
  await prisma.invoice_line_items.deleteMany({ where: { invoice_id: existing.invoice_id } })
  await prisma.invoices.delete({ where: { invoice_id: existing.invoice_id } })
}

export async function syncContainerUnloadInvoiceForOrder(
  orderId: bigint,
  userId?: bigint | null
): Promise<{ ok: boolean; invoice_id?: bigint; error?: string }> {
  try {
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId },
      include: {
        order_detail: {
          include: {
            locations_order_detail_delivery_location_idTolocations: {
              select: { location_id: true, name: true, location_code: true },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!order) {
      return { ok: false, error: 'order_not_found' }
    }

    if (isOrderCancelledStatus(order.status)) {
      await deleteUnloadInvoiceByOrderId(orderId)
      return { ok: true }
    }

    if (!order.customer_id) {
      return { ok: false, error: 'no_customer' }
    }

    if (order.operation_mode !== 'unload') {
      await deleteUnloadInvoiceByOrderId(orderId)
      return { ok: true }
    }

    const fees = await loadApplicableFeesForCustomer(order.customer_id)
    const invoiceDate = new Date()
    const details = order.order_detail ?? []
    const volumePctByDetailId = volumePercentageFromVolumesByDetailId(details)

    let invoice = await prisma.invoices.findFirst({
      where: { order_id: orderId, invoice_type: 'unload' },
    })

    let isNewInvoice = false
    if (!invoice) {
      const number = await getNextContainerUnloadInvoiceNumber()
      invoice = await prisma.invoices.create({
        data: {
          invoice_type: 'unload',
          invoice_number: number,
          customer_id: order.customer_id,
          order_id: orderId,
          total_amount: 0,
          tax_amount: 0,
          currency: 'USD',
          invoice_date: invoiceDate,
          status: 'draft',
          created_by: userId ?? null,
          updated_by: userId ?? null,
        },
      })
      isNewInvoice = true
    }

    const invId = invoice.invoice_id
    const wasAudited = invoice.status === 'audited'
    if (!isNewInvoice && wasAudited) {
      const block = await getReceivableWithdrawBlockReason(prisma, invId)
      if (block) {
        return { ok: false, error: 'receivable_blocked' }
      }
    }

    const lines: Prisma.invoice_line_itemsCreateManyInput[] = []
    let sort = 0

    for (const detail of details) {
      const loc = detail.locations_order_detail_delivery_location_idTolocations
      const locLabel = loc?.name || loc?.location_code || '未指定仓'
      const pctFromDb =
        detail.volume_percentage != null ? Number(detail.volume_percentage) : null
      const pctFromVolume = volumePctByDetailId.get(detail.id.toString()) ?? null
      const pctRaw =
        pctFromDb != null && !Number.isNaN(pctFromDb)
          ? pctFromDb
          : pctFromVolume != null && !Number.isNaN(pctFromVolume)
            ? pctFromVolume
            : details.length === 1
              ? 100
              : null
      const pct =
        pctRaw != null && !Number.isNaN(pctRaw)
          ? pctRaw
          : details.length === 1
            ? 100
            : 0
      const qty = pct / 100

      const terminal = usesTerminalPickUpForDetail(detail, loc)
      let fee = terminal
        ? pickTerminalPickUpFee(fees, order, order.customer_id)
        : pickAmazonComboFee(fees, order, order.customer_id, loc)
      let usedAmazonFallback = false
      if (!terminal && !fee) {
        fee = pickAmazonComboFeeFallback(fees, order, order.customer_id)
        if (fee) usedAmazonFallback = true
      }

      let unitPriceNum = fee ? Number(fee.unit_price) : 0
      let feeCode = fee?.fee_code ?? (terminal ? 'TERMINAL_PICKUP' : '亚马逊组合柜')
      let feeName =
        fee?.fee_name ??
        (terminal ? `提拆一口价（${locLabel}）` : `亚马逊组合柜（${locLabel}）`)
      let notes = `分仓占比 ${pct}%`
      if (terminal) {
        // 与订单详情页「送仓地点」列一致：delivery_location_code || delivery_location（序列化后均为 location_code）|| '-'
        const deliveryLocationAsOrderDetailPage =
          loc?.location_code?.trim() || '-'
        notes += `；送仓地点：${deliveryLocationAsOrderDetailPage}`
      }

      lines.push({
        invoice_id: invId,
        fee_id: null,
        fee_code: feeCode,
        fee_name: feeName,
        unit: fee?.unit ?? null,
        line_notes: notes,
        order_detail_id: detail.id,
        quantity: new Prisma.Decimal(qty.toFixed(6)),
        unit_price: new Prisma.Decimal(unitPriceNum.toFixed(2)),
        total_amount: new Prisma.Decimal((unitPriceNum * qty).toFixed(2)),
        sort_order: sort++,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
    }

    const detentionCount = details.filter((d) => d.delivery_nature === '扣货').length
    if (detentionCount > 0) {
      const intf = pickInterceptFee(fees, order, order.customer_id)
      const unit = intf ? Number(intf.unit_price) : 0
      const totalAmt = unit * detentionCount
      lines.push({
        invoice_id: invId,
        fee_id: null,
        fee_code: intf?.fee_code ?? '拦截费',
        fee_name: intf?.fee_name ?? '拦截费',
        unit: intf?.unit ?? '票',
        line_notes: `扣货明细 ${detentionCount} 条 × 单价；${!intf ? '未匹配费用主数据' : ''}`,
        order_detail_id: null,
        quantity: new Prisma.Decimal(detentionCount),
        unit_price: new Prisma.Decimal(unit.toFixed(2)),
        total_amount: new Prisma.Decimal(totalAmt.toFixed(2)),
        sort_order: sort++,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
    }

    const totalCartons = details.reduce((s, d) => s + (d.quantity ?? 0), 0)
    if (totalCartons > BOX_THRESHOLD) {
      const excess = totalCartons - BOX_THRESHOLD
      const obf = pickOverBoxFee(fees, order, order.customer_id)
      const rate = obf ? Number(obf.unit_price) : 0.3
      const totalAmt = rate * excess
      lines.push({
        invoice_id: invId,
        fee_id: null,
        fee_code: obf?.fee_code ?? '超箱费',
        fee_name: obf?.fee_name ?? '超箱费',
        unit: obf?.unit ?? '箱',
        line_notes: `全单总箱数 ${totalCartons}，超出 ${BOX_THRESHOLD} 部分 ${excess} 箱 × ${rate}`,
        order_detail_id: null,
        quantity: new Prisma.Decimal(excess),
        unit_price: new Prisma.Decimal(rate.toFixed(2)),
        total_amount: new Prisma.Decimal(totalAmt.toFixed(2)),
        sort_order: sort++,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
    }

    if (details.length > 10) {
      const extraLines = details.length - 10
      const wf = pickWarehousePointFee(fees, order, order.customer_id)
      const unit = wf ? Number(wf.unit_price) : 0
      const totalAmt = unit * extraLines
      lines.push({
        invoice_id: invId,
        fee_id: null,
        fee_code: wf?.fee_code ?? '仓点费',
        fee_name: wf?.fee_name ?? '仓点费',
        unit: wf?.unit ?? '条',
        line_notes: `订单明细 ${details.length} 条，超出 10 条部分 ${extraLines} 条`,
        order_detail_id: null,
        quantity: new Prisma.Decimal(extraLines),
        unit_price: new Prisma.Decimal(unit.toFixed(2)),
        total_amount: new Prisma.Decimal(totalAmt.toFixed(2)),
        sort_order: sort++,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
    }

    const chFee = pickChassisFee(fees, order, order.customer_id)
    const chPrice = chFee ? Number(chFee.unit_price) : 0
    lines.push({
      invoice_id: invId,
      fee_id: null,
      fee_code: chFee?.fee_code ?? 'CHASSIS',
      fee_name: chFee?.fee_name ?? '车架费',
      unit: chFee?.unit ?? null,
      line_notes: '拆柜包四天',
      order_detail_id: null,
      quantity: new Prisma.Decimal(1),
      unit_price: new Prisma.Decimal(chPrice.toFixed(2)),
      total_amount: new Prisma.Decimal(chPrice.toFixed(2)),
      sort_order: sort++,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })

    await prisma.$transaction(async (tx) => {
      if (!isNewInvoice) {
        await tx.invoice_line_items.deleteMany({ where: { invoice_id: invId } })
        await tx.invoices.update({
          where: { invoice_id: invId },
          data: { updated_by: userId ?? undefined, updated_at: new Date() },
        })
      }
      if (lines.length > 0) {
        await tx.invoice_line_items.createMany({ data: lines })
      }
      await recalcInvoiceTotal(invId, tx)
      if (!isNewInvoice && wasAudited) {
        await downgradeAuditedInvoiceAfterLineMutation(tx, invId, userId ?? null)
      }
    })

    return { ok: true, invoice_id: invId }
  } catch (e) {
    console.error('[syncContainerUnloadInvoiceForOrder]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'sync_failed' }
  }
}

export function scheduleContainerUnloadInvoiceSync(orderId: bigint, userId?: bigint | null) {
  syncContainerUnloadInvoiceForOrder(orderId, userId).catch((err) => {
    console.error(`[scheduleContainerUnloadInvoiceSync] order ${orderId}`, err)
  })
}
