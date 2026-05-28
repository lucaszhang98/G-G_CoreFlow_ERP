import type { Prisma } from '@prisma/client'

export function shouldPaymentWriteOff(
  paymentAmount: number,
  allocatedTotal: number
): boolean {
  const remaining = Math.max(0, paymentAmount - allocatedTotal)
  return remaining <= 1e-6
}

export async function syncPaymentWriteOffById(
  tx: Prisma.TransactionClient,
  paymentId: bigint
): Promise<void> {
  const payment = await tx.payments.findUnique({
    where: { payment_id: paymentId },
    select: { amount: true },
  })
  if (!payment) return

  const agg = await tx.payment_allocations.aggregate({
    where: { payment_id: paymentId },
    _sum: { allocated_amount: true },
  })
  const allocatedTotal = Number(agg._sum.allocated_amount ?? 0)
  const writeOff = shouldPaymentWriteOff(Number(payment.amount), allocatedTotal)

  await tx.payments.update({
    where: { payment_id: paymentId },
    data: {
      write_off: writeOff,
      updated_at: new Date(),
    },
  })
}
