/**
 * 客户费用表：该客户适用的费用列表（与费用管理同结构，仅按客户筛选）
 */
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { BackButton } from "@/components/ui/back-button"
import prisma from "@/lib/prisma"
import { CustomerFeesTable } from "./customer-fees-table"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerFeesPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id: customerId } = await params
  const customer = await prisma.customers.findUnique({
    where: { id: BigInt(customerId) },
    select: { id: true, code: true, name: true },
  })
  if (!customer) notFound()

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <BackButton fallbackUrl={`/dashboard/customers/${customerId}`} />
          <h1 className="text-2xl font-semibold">
            {customer.name || customer.code || "客户"} - 费用表
          </h1>
        </div>
        <CustomerFeesTable customerId={customerId} />
      </div>
    </DashboardLayout>
  )
}
