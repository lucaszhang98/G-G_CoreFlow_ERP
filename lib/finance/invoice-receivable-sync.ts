/**
 * 发票「已审核」与应收模块联动：推送、退回、以及明细变更后的状态降级。
 */

import { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export class ReceivableWithdrawError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceivableWithdrawError'
  }
}

/** 若该发票对应应收已有核销金额，返回不可退回的原因文案；否则返回 null。 */
export async function getReceivableWithdrawBlockReason(
  db: DbClient,
  invoiceId: bigint
): Promise<string | null> {
  const rec = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: { allocated_amount: true },
  })
  if (!rec) return null
  if (Number(rec.allocated_amount ?? 0) > 0) {
    return '该账单在应收已有收款分配，无法完成此操作。请先处理收款核销后再试。'
  }
  return null
}

/**
 * 根据应收金额与已核销（仅由收款分配累加）计算余额与状态；与 upsertReceivableForAuditedInvoice 规则一致。
 */
export function deriveReceivableBalanceAndStatus(
  receivableAmount: Prisma.Decimal | number | string,
  allocatedAmount: Prisma.Decimal | number | string
): { balance: Prisma.Decimal; status: 'open' | 'partial' | 'closed' } {
  const totalDec = new Prisma.Decimal(receivableAmount.toString())
  const allocated = new Prisma.Decimal(allocatedAmount.toString())
  const balance = totalDec.sub(allocated)

  let status: 'open' | 'partial' | 'closed'
  if (totalDec.lt(0)) {
    if (balance.eq(0)) {
      status = 'closed'
    } else if (allocated.gt(0)) {
      status = 'partial'
    } else {
      status = 'open'
    }
  } else if (balance.lte(0)) {
    status = 'closed'
  } else if (allocated.gt(0)) {
    status = 'partial'
  } else {
    status = 'open'
  }

  return { balance, status }
}

/**
 * 到期日 = 开票日期的次月同日（如 5/20 → 6/20；使用 UTC 日期部分，与 @db.Date 一致）。
 */
export function dueDateOneMonthAfterInvoiceDate(
  invoiceDate: Date | string
): Date {
  const d = new Date(invoiceDate)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return new Date(Date.UTC(y, m + 1, day))
}

/**
 * 删除收款前在同一事务内调用：按核销明细冲回应收的已核销额，并重算 balance/status。
 * 随后删除 payment 行即可由级联删除 payment_allocations。
 */
export async function reversePaymentAllocationsForDeletionTx(
  tx: Prisma.TransactionClient,
  paymentId: bigint,
  userId: bigint | null
): Promise<void> {
  const rows = await tx.payment_allocations.findMany({
    where: { payment_id: paymentId },
    select: { receivable_id: true, allocated_amount: true },
  })

  for (const row of rows) {
    const recv = await tx.receivables.findUnique({
      where: { receivable_id: row.receivable_id },
      select: {
        receivable_id: true,
        receivable_amount: true,
        allocated_amount: true,
      },
    })
    if (!recv) continue

    const prev = new Prisma.Decimal(recv.allocated_amount?.toString() ?? '0')
    const sub = new Prisma.Decimal(row.allocated_amount.toString())
    let newAllocated = prev.sub(sub)
    if (newAllocated.lt(0)) {
      newAllocated = new Prisma.Decimal(0)
    }

    const { balance, status } = deriveReceivableBalanceAndStatus(
      recv.receivable_amount,
      newAllocated
    )

    await tx.receivables.update({
      where: { receivable_id: row.receivable_id },
      data: {
        allocated_amount: newAllocated,
        balance,
        status,
        updated_at: new Date(),
        updated_by: userId,
      },
    })
  }
}

/** 状态为已审核时，将发票金额同步到应收（单票一条应收，按 invoice_id 关联）。 */
export async function upsertReceivableForAuditedInvoice(
  db: DbClient,
  invoiceId: bigint,
  userId: bigint | null
): Promise<void> {
  const inv = await db.invoices.findUnique({
    where: { invoice_id: invoiceId },
    select: {
      customer_id: true,
      total_amount: true,
      invoice_date: true,
      status: true,
    },
  })
  if (!inv || inv.status !== 'audited') return

  const existing = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: {
      receivable_id: true,
      allocated_amount: true,
    },
  })

  const receivableAmount = inv.total_amount
  const allocated = existing?.allocated_amount ?? new Prisma.Decimal(0)
  const totalDec = new Prisma.Decimal(receivableAmount.toString())
  const { balance, status } = deriveReceivableBalanceAndStatus(totalDec, allocated)

  const common = {
    customer_id: inv.customer_id,
    receivable_amount: receivableAmount,
    allocated_amount: allocated,
    balance,
    due_date: dueDateOneMonthAfterInvoiceDate(inv.invoice_date),
    status,
    updated_by: userId,
    updated_at: new Date(),
  }

  if (existing) {
    await db.receivables.update({
      where: { receivable_id: existing.receivable_id },
      data: common,
    })
  } else {
    await db.receivables.create({
      data: {
        invoice_id: invoiceId,
        ...common,
        created_by: userId,
      },
    })
  }
}

/** 从应收中移除该票（无核销金额时删除记录）。若已有核销则抛出 ReceivableWithdrawError。 */
export async function withdrawReceivableForInvoice(
  db: DbClient,
  invoiceId: bigint
): Promise<void> {
  const rec = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: { receivable_id: true, allocated_amount: true },
  })
  if (!rec) return
  if (Number(rec.allocated_amount ?? 0) > 0) {
    throw new ReceivableWithdrawError(
      '该账单在应收已有收款分配，无法自动从应收退回。请先处理收款核销后再变更状态。'
    )
  }
  await db.receivables.delete({
    where: { receivable_id: rec.receivable_id },
  })
}

/**
 * 已审核状态下若修改了明细：删除应收并将发票降为「已开票」。
 * 调用方应在事务内执行；若当前非已审核则 noop。
 */
export async function downgradeAuditedInvoiceAfterLineMutation(
  tx: Prisma.TransactionClient,
  invoiceId: bigint,
  userId: bigint | null
): Promise<void> {
  const inv = await tx.invoices.findUnique({
    where: { invoice_id: invoiceId },
    select: { status: true },
  })
  if (inv?.status !== 'audited') return

  await withdrawReceivableForInvoice(tx, invoiceId)

  await tx.invoices.update({
    where: { invoice_id: invoiceId },
    data: {
      status: 'issued',
      updated_by: userId,
      updated_at: new Date(),
    },
  })
}

/**
 * 从应收管理删除一条应收（须在事务内调用）：
 * - 关联发票为「已审核」：与「已审核账单在账单管理里改明细」一致——删应收并将发票降为「已开票」；已有核销则抛 ReceivableWithdrawError。
 * - 否则：仅删除该应收行。
 */
export async function deleteReceivableAndSyncInvoiceTx(
  tx: Prisma.TransactionClient,
  receivableId: bigint,
  userId: bigint | null
): Promise<void> {
  const rec = await tx.receivables.findUnique({
    where: { receivable_id: receivableId },
    select: { receivable_id: true, invoice_id: true },
  })
  if (!rec) {
    const err = new Error('NOT_FOUND') as Error & { code: string }
    err.code = 'P2025'
    throw err
  }

  const inv = await tx.invoices.findUnique({
    where: { invoice_id: rec.invoice_id },
    select: { invoice_id: true, status: true },
  })

  if (!inv) {
    await tx.receivables.delete({ where: { receivable_id: receivableId } })
    return
  }

  if (inv.status === 'audited') {
    const block = await getReceivableWithdrawBlockReason(tx, rec.invoice_id)
    if (block) {
      throw new ReceivableWithdrawError(block)
    }
    await downgradeAuditedInvoiceAfterLineMutation(tx, rec.invoice_id, userId)
    return
  }

  await tx.receivables.delete({ where: { receivable_id: receivableId } })
}
