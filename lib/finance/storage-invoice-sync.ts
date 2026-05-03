/**
 * 仓储账单（invoice_type=storage）：已入库 + 订单存在「扣货」明细时，按每条预约明细生成一行；
 * 入/出库时间、计费天数与金额随预约与拆柜日期重算。
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getNextStorageInvoiceNumber } from '@/lib/finance/next-storage-invoice-number'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import {
  downgradeAuditedInvoiceAfterLineMutation,
  getReceivableWithdrawBlockReason,
  ReceivableWithdrawError,
  withdrawReceivableForInvoice,
} from '@/lib/finance/invoice-receivable-sync'
import { feeMatchesContainer } from '@/lib/finance/fee-matching'
import { prismaAppointmentDetailLinesWhereParentAppointmentActive } from '@/lib/utils/delivery-appointment-enabled'

const INBOUND_RECEIVED = 'received'
/** 与订单明细、业务约定一致 */
export const STORAGE_DETENTION_DELIVERY_NATURE = '扣货'

function normCode(code: string) {
  return code.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function isStorageFamilyFee(f: { fee_code: string; fee_name: string }) {
  const c = normCode(f.fee_code)
  if (c === 'storage' || c.includes('storage')) return true
  if (f.fee_name.includes('仓储')) return true
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

function pickStorageFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter((f) => isStorageFamilyFee(f))
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

/** 按 UTC 日历日计算在库天数（出库日 − 入库日，同日为 0） */
export function calendarStorageDays(inAt: Date, outAt: Date): number {
  const s = Date.UTC(inAt.getUTCFullYear(), inAt.getUTCMonth(), inAt.getUTCDate())
  const e = Date.UTC(outAt.getUTCFullYear(), outAt.getUTCMonth(), outAt.getUTCDate())
  return Math.max(0, Math.floor((e - s) / 86400000))
}

/**
 * 免租 7 天后：前 30 个计费日按 1:1，超出部分每个日历日计 1.5 个计费日
 */
export function computeStorageBillingUnits(calendarDays: number): number {
  const d = Math.max(0, calendarDays - 7)
  if (d <= 30) return d
  return 30 + (d - 30) * 1.5
}

function dateToUtcStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function deleteStorageInvoiceCompletely(
  tx: Prisma.TransactionClient,
  invoiceId: bigint,
  status: string | null | undefined
): Promise<void> {
  if (status === 'audited') {
    await withdrawReceivableForInvoice(tx, invoiceId)
  }
  await tx.invoice_line_items.deleteMany({ where: { invoice_id: invoiceId } })
  await tx.invoices.delete({ where: { invoice_id: invoiceId } })
}

export async function syncStorageInvoiceForOrder(
  orderId: bigint,
  userId?: bigint | null
): Promise<{ ok: boolean; invoice_id?: bigint; error?: string }> {
  try {
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId },
      select: {
        order_id: true,
        customer_id: true,
        container_type: true,
        status: true,
        pickup_date: true,
        eta_date: true,
      },
    })
    if (!order || !order.customer_id) {
      return { ok: false, error: 'order_not_found_or_no_customer' }
    }

    const inbound = await prisma.inbound_receipt.findUnique({
      where: { order_id: orderId },
      select: { status: true, planned_unload_at: true, updated_at: true },
    })

    const detentionDetailIds = (
      await prisma.order_detail.findMany({
        where: {
          order_id: orderId,
          delivery_nature: STORAGE_DETENTION_DELIVERY_NATURE,
        },
        select: { id: true },
      })
    ).map((r) => r.id)

    /** 已入库且存在扣货明细即应有仓储账单（可为 0 行草稿，待预约时间补齐） */
    const shouldHaveBill =
      inbound?.status === INBOUND_RECEIVED && detentionDetailIds.length > 0

    const existing = await prisma.invoices.findFirst({
      where: { order_id: orderId, invoice_type: 'storage' },
    })

    if (!shouldHaveBill) {
      if (existing) {
        try {
          await prisma.$transaction(async (tx) => {
            await deleteStorageInvoiceCompletely(tx, existing.invoice_id, existing.status)
          })
        } catch (e: unknown) {
          if (e instanceof ReceivableWithdrawError) {
            return { ok: false, error: 'receivable_blocked' }
          }
          throw e
        }
      }
      return { ok: true }
    }

    /** 入库计费起点：拆柜日 → 提柜日 → ETA → 入库单更新时间 */
    const toDate = (v: Date | string | null | undefined): Date | null => {
      if (v == null) return null
      if (v instanceof Date) return v
      const d = new Date(String(v))
      return Number.isNaN(d.getTime()) ? null : d
    }
    const inAtRaw =
      toDate(inbound!.planned_unload_at) ??
      toDate(order.pickup_date) ??
      toDate(order.eta_date) ??
      toDate(inbound!.updated_at)
    const storageInAt = inAtRaw ? dateToUtcStart(inAtRaw) : null

    const adLines = await prisma.appointment_detail_lines.findMany({
      where: {
        order_detail_id: { in: detentionDetailIds },
        ...prismaAppointmentDetailLinesWhereParentAppointmentActive,
      },
      include: {
        delivery_appointments: {
          select: {
            confirmed_start: true,
            requested_start: true,
          },
        },
      },
      orderBy: [{ id: 'asc' }],
    })

    const fees = await loadApplicableFeesForCustomer(order.customer_id)
    const storageFee = pickStorageFee(fees, order, order.customer_id)
    const baseUnitPrice = storageFee ? Number(storageFee.unit_price) : 0

    let invoice = existing
    let isNewInvoice = false
    const invoiceDate = new Date()

    if (!invoice) {
      const number = await getNextStorageInvoiceNumber()
      invoice = await prisma.invoices.create({
        data: {
          invoice_type: 'storage',
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

    if (storageInAt) {
      for (const adl of adLines) {
        const appt = adl.delivery_appointments
        const outRaw = appt?.confirmed_start ?? appt?.requested_start
        if (!outRaw) continue

        const storageOutAt = new Date(outRaw)
        const calendarDays = calendarStorageDays(storageInAt, storageOutAt)
        const billingUnits = computeStorageBillingUnits(calendarDays)
        const est = adl.estimated_pallets ?? 0
        const rej = adl.rejected_pallets ?? 0
        const pallets = Math.max(0, est - rej)

        const totalAmt = billingUnits * pallets * baseUnitPrice
        const qtyDec = new Prisma.Decimal(billingUnits.toFixed(4))
        const unitPriceDec = new Prisma.Decimal((pallets * baseUnitPrice).toFixed(2))

        const lineNotes = [
          `板数 ${pallets}`,
          `日历在库 ${calendarDays} 天`,
          `免租 7 天后计费天 ${billingUnits.toFixed(2)}`,
        ].join('；')

        lines.push({
          invoice_id: invId,
          fee_id: storageFee?.id ?? null,
          fee_code: storageFee?.fee_code ?? 'STORAGE',
          fee_name: storageFee?.fee_name ?? '仓储费',
          unit: `${billingUnits.toFixed(2)}计费天`,
          line_notes: lineNotes,
          order_detail_id: adl.order_detail_id,
          appointment_detail_line_id: adl.id,
          storage_in_at: storageInAt,
          storage_out_at: storageOutAt,
          quantity: qtyDec,
          unit_price: unitPriceDec,
          total_amount: new Prisma.Decimal(totalAmt.toFixed(2)),
          sort_order: sort++,
          created_by: userId ?? null,
          updated_by: userId ?? null,
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice_line_items.deleteMany({ where: { invoice_id: invId } })
      await tx.invoices.update({
        where: { invoice_id: invId },
        data: { updated_by: userId ?? undefined, updated_at: new Date() },
      })
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
    console.error('[syncStorageInvoiceForOrder]', orderId, e)
    return { ok: false, error: e instanceof Error ? e.message : 'sync_failed' }
  }
}

export function scheduleStorageInvoiceSync(orderId: bigint, userId?: bigint | null) {
  syncStorageInvoiceForOrder(orderId, userId).catch((err) => {
    console.error(`[scheduleStorageInvoiceSync] order ${orderId}`, err)
  })
}

/**
 * 一次性补全：所有「入库已入库 + 订单含扣货明细」的订单重算仓储账单（用于历史数据或代码上线后补跑）。
 */
export async function backfillAllStorageInvoicesForReceivedDetentionOrders(
  userId?: bigint | null
): Promise<{
  orderCount: number
  ok: number
  failed: number
  errors: { order_id: string; error?: string }[]
}> {
  const rows = await prisma.inbound_receipt.findMany({
    where: {
      status: INBOUND_RECEIVED,
      orders: {
        order_detail: {
          some: { delivery_nature: STORAGE_DETENTION_DELIVERY_NATURE },
        },
      },
    },
    select: { order_id: true },
  })
  const seen = new Set<string>()
  const orderIds: bigint[] = []
  for (const r of rows) {
    const k = r.order_id.toString()
    if (seen.has(k)) continue
    seen.add(k)
    orderIds.push(r.order_id)
  }

  const errors: { order_id: string; error?: string }[] = []
  let ok = 0
  let failed = 0
  for (const oid of orderIds) {
    const res = await syncStorageInvoiceForOrder(oid, userId)
    if (res.ok) ok++
    else {
      failed++
      errors.push({ order_id: oid.toString(), error: res.error })
    }
  }
  return {
    orderCount: orderIds.length,
    ok,
    failed,
    errors: errors.slice(0, 200),
  }
}
