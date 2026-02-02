/**
 * 发票管理列表页 - Phase 1 骨架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { invoiceConfig } from "@/lib/crud/configs/invoices"

export default async function InvoicesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={invoiceConfig} />
    </DashboardLayout>
  )
}
