/**
 * 直送账单发票号：S + 当前年(4) + 当前月(2) + 4位顺序号，每月重置
 */

import prisma from '@/lib/prisma'

export async function getNextDirectDeliveryNumber(): Promise<string> {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `S${yyyy}${mm}`

  const list = await prisma.invoices.findMany({
    where: {
      invoice_type: 'direct_delivery',
      invoice_number: { startsWith: prefix },
    },
    select: { invoice_number: true },
    orderBy: { invoice_number: 'desc' },
    take: 1,
  })

  let nextSeq = 1
  if (list.length > 0) {
    const last = list[0].invoice_number
    const suffix = last.slice(prefix.length)
    const num = parseInt(suffix, 10)
    if (!Number.isNaN(num) && num >= 0) nextSeq = num + 1
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}
