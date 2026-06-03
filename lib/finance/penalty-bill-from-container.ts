/**
 * 负数账单（返利）：按柜号（订单 order_number）建主行，并自动带一条费用表明细。
 * - 匹配费用编码：归一化后为 other 或 others（如 Others、OTHER、other）。
 * - 取费规则与直送/拆柜一致：同一客户适用费用 + 柜型打分（见 scoreFee）；必须使用费用表命中行，写入 fee_id / fee_code / fee_name / unit。
 * - line_notes 固定「返利」；单价默认 -100（数量 1）。
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getNextPenaltyInvoiceNumber } from '@/lib/finance/next-penalty-invoice-number'
import { recalcInvoiceTotal } from '@/lib/finance/recalc-invoice-total'
import { feeMatchesContainer } from '@/lib/finance/fee-matching'
import {
  findOperationalOrderByNumber,
  formatOperationalOrderNotFoundMessage,
} from '@/lib/orders/operational-order-lookup'

const REBATE_LINE_NOTES = '返利'
const DEFAULT_REBATE_UNIT_PRICE = -100

function normCode(code: string) {
  return code.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** 与费用主数据一致：Others → others；OTHER/other → other */
function isOtherFamilyFeeCode(code: string) {
  const n = normCode(code)
  return n === 'other' || n === 'others'
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

function pickOtherFee(
  fees: Awaited<ReturnType<typeof loadApplicableFeesForCustomer>>,
  order: { container_type: string | null },
  customerId: bigint
) {
  const candidates = fees.filter((f) => isOtherFamilyFeeCode(f.fee_code))
  if (candidates.length === 0) return null
  return [...candidates].sort(
    (a, b) => scoreFee(b, order, customerId) - scoreFee(a, order, customerId)
  )[0]
}

export type CreatePenaltyFromContainerResult =
  | { ok: true; invoice_id: bigint; order_number: string }
  | { ok: false; error: string; status?: number }

/**
 * 按柜号创建负数账单：一单一条返利明细（other），单价默认 -100。
 */
export async function createPenaltyRebateInvoiceFromContainerNumber(
  containerNumber: string,
  userId: bigint | null
): Promise<CreatePenaltyFromContainerResult> {
  const trimmed = containerNumber.trim()
  if (!trimmed) {
    return { ok: false, error: '请输入柜号', status: 400 }
  }

  const order = await findOperationalOrderByNumber({
    orderNumber: trimmed,
    select: {
      order_id: true,
      customer_id: true,
      order_number: true,
      container_type: true,
      status: true,
    },
  })

  if (!order) {
    const msg = await formatOperationalOrderNotFoundMessage(trimmed)
    return { ok: false, error: msg, status: 404 }
  }

  if (order.customer_id == null) {
    return { ok: false, error: '该订单未关联客户，无法创建负数账单', status: 400 }
  }
  const customerId = order.customer_id

  const existing = await prisma.invoices.findFirst({
    where: { order_id: order.order_id, invoice_type: 'penalty' },
    select: { invoice_id: true },
  })
  if (existing) {
    return {
      ok: false,
      error: '该柜号已存在负数账单，请在列表中打开或删除后再新建',
      status: 409,
    }
  }

  const fees = await loadApplicableFeesForCustomer(customerId)
  const otherFee = pickOtherFee(fees, order, customerId)
  if (!otherFee) {
    return {
      ok: false,
      error:
        '未在费用表中找到与该客户、柜型匹配的 Others/other 费用行，请在费用管理中维护后再创建负数账单。',
      status: 400,
    }
  }

  const invoiceDate = new Date()
  const invoiceNumber = await getNextPenaltyInvoiceNumber()

  const qty = 1
  /** 返利行单价默认 -100；编码/名称/单位与 fee_id 均来自费用表命中行 */
  const unitPrice = DEFAULT_REBATE_UNIT_PRICE
  const totalAmt = unitPrice * qty

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoices.create({
      data: {
        invoice_type: 'penalty',
        invoice_number: invoiceNumber,
        customer_id: customerId,
        order_id: order.order_id,
        total_amount: 0,
        tax_amount: 0,
        currency: 'USD',
        invoice_date: invoiceDate,
        status: 'draft',
        created_by: userId ?? null,
        updated_by: userId ?? null,
      },
    })

    await tx.invoice_line_items.create({
      data: {
        invoice_id: inv.invoice_id,
        fee_id: otherFee.id,
        fee_code: otherFee.fee_code,
        fee_name: otherFee.fee_name,
        unit: otherFee.unit,
        line_notes: REBATE_LINE_NOTES,
        order_detail_id: null,
        quantity: new Prisma.Decimal(String(qty)),
        unit_price: new Prisma.Decimal(unitPrice.toFixed(2)),
        total_amount: new Prisma.Decimal(totalAmt.toFixed(2)),
        sort_order: 0,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      },
    })

    await recalcInvoiceTotal(inv.invoice_id, tx)
    return inv
  })

  return {
    ok: true,
    invoice_id: invoice.invoice_id,
    order_number: order.order_number,
  }
}
