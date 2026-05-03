/**
 * 直送订单与直送账单 1:1：按费用管理快照生成明细行（不写入 fee_id，仅保存 fee_code/fee_name/单价等）。
 * - 订单非直送：删除对应直送账单。
 * - 订单状态为已取消：删除对应直送账单（完成留档仍正常出账）。
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getNextDirectDeliveryNumber } from '@/lib/finance/next-direct-delivery-number'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import {
  downgradeAuditedInvoiceAfterLineMutation,
  getReceivableWithdrawBlockReason,
} from '@/lib/finance/invoice-receivable-sync'
import { isOrderCancelledStatus } from '@/lib/orders/order-visibility'
import { feeMatchesContainer } from '@/lib/finance/fee-matching'
import { volumePercentageFromVolumesByDetailId } from '@/lib/finance/order-detail-volume-percentage'

async function deleteDirectDeliveryInvoiceByOrderId(orderId: bigint): Promise<void> {
  const existing = await prisma.invoices.findFirst({
    where: { order_id: orderId, invoice_type: 'direct_delivery' },
    select: { invoice_id: true },
  })
  if (!existing) return
  await prisma.invoice_line_items.deleteMany({ where: { invoice_id: existing.invoice_id } })
  await prisma.invoices.delete({ where: { invoice_id: existing.invoice_id } })
}

function normCode(code: string) {
  return code.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function isAllInCode(code: string) {
  return normCode(code) === 'allin'
}

function isChassisCode(code: string) {
  return normCode(code).includes('chassis')
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

function pickAllInFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint,
  loc: { name: string | null; location_code: string | null } | null
) {
  const candidates = fees.filter((f) => isAllInCode(f.fee_code) && locationMatchesFeeName(f.fee_name, loc))
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

function pickChassisFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter((f) => isChassisCode(f.fee_code))
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

export async function syncDirectDeliveryInvoiceForOrder(
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
      await deleteDirectDeliveryInvoiceByOrderId(orderId)
      return { ok: true }
    }

    if (!order.customer_id) {
      return { ok: false, error: 'no_customer' }
    }

    if (order.operation_mode !== 'direct_delivery') {
      await deleteDirectDeliveryInvoiceByOrderId(orderId)
      return { ok: true }
    }

    const fees = await loadApplicableFeesForCustomer(order.customer_id)
    const invoiceDate = new Date()

    let invoice = await prisma.invoices.findFirst({
      where: { order_id: orderId, invoice_type: 'direct_delivery' },
    })

    let isNewInvoice = false
    if (!invoice) {
      const number = await getNextDirectDeliveryNumber(invoiceDate)
      invoice = await prisma.invoices.create({
        data: {
          invoice_type: 'direct_delivery',
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
    const details = order.order_detail ?? []
    const volumePctByDetailId = volumePercentageFromVolumesByDetailId(details)
    const lines: Prisma.invoice_line_itemsCreateManyInput[] = []
    let sort = 0

    for (const detail of details) {
      const loc = detail.locations_order_detail_delivery_location_idTolocations
      const locLabel = loc?.name || loc?.location_code || '未指定仓'
      const allInFee = pickAllInFee(fees, order, order.customer_id, loc)
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

      const unitPriceNum = allInFee ? Number(allInFee.unit_price) : 0
      const qty = pct / 100
      const totalAmt = unitPriceNum * qty

      lines.push({
        invoice_id: invId,
        fee_id: null,
        fee_code: allInFee?.fee_code ?? 'ALL_IN',
        fee_name: allInFee?.fee_name ?? `All-in（${locLabel}）`,
        unit: allInFee?.unit ?? null,
        line_notes: `分仓占比 ${pct}%`,
        order_detail_id: detail.id,
        quantity: new Prisma.Decimal(qty.toFixed(6)),
        unit_price: new Prisma.Decimal(unitPriceNum.toFixed(2)),
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
      fee_name: chFee?.fee_name ?? 'Chassis fee',
      unit: chFee?.unit ?? null,
      line_notes: chFee ? null : '未匹配到 chassis 费用',
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
    console.error('[syncDirectDeliveryInvoiceForOrder]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'sync_failed' }
  }
}

/**
 * 供 API 异步调用：不阻塞主流程
 */
export function scheduleDirectDeliveryInvoiceSync(orderId: bigint, userId?: bigint | null) {
  syncDirectDeliveryInvoiceForOrder(orderId, userId).catch((err) => {
    console.error(`[scheduleDirectDeliveryInvoiceSync] order ${orderId}`, err)
  })
}
