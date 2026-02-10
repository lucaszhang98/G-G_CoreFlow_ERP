/**
 * 直送账单详情 - 主行信息 + 账单明细（从费用管理选择，数量×单价=总价）
 */

import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"
import { DirectDeliveryBillDetailClient } from "./direct-delivery-bill-detail-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DirectDeliveryBillDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  if (!id || isNaN(Number(id))) notFound()

  const invoice = await prisma.invoices.findUnique({
    where: { invoice_id: BigInt(id) },
    include: {
      customers: { select: { id: true, code: true, name: true } },
      orders: { select: { order_id: true, order_number: true } },
    },
  })

  if (!invoice || invoice.invoice_type !== "direct_delivery") notFound()

  const serialized = serializeBigInt(invoice)

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-6xl py-8">
        <DirectDeliveryBillDetailClient invoiceId={id} invoice={serialized} />
      </div>
    </DashboardLayout>
  )
}
