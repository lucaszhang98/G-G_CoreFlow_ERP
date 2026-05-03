/**
 * 仓储账单详情 - 明细由系统同步，只读展示
 */

import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"
import { InvoiceBillDetailClient } from "@/components/finance/invoice-bill-detail-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StorageBillDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  if (!id || isNaN(Number(id))) notFound()

  const invoice = await prisma.invoices.findUnique({
    where: { invoice_id: BigInt(id) },
    include: {
      customers: { select: { id: true, code: true, name: true } },
      orders: {
        select: {
          order_id: true,
          order_number: true,
          container_type: true,
        },
      },
    },
  })

  if (!invoice || invoice.invoice_type !== "storage") notFound()

  const serialized = serializeBigInt(invoice)

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-6xl py-8">
        <InvoiceBillDetailClient
          invoiceId={id}
          invoice={serialized}
          backListHref="/dashboard/finance/bills/storage"
          billKindLabel="仓储账单"
        />
      </div>
    </DashboardLayout>
  )
}
