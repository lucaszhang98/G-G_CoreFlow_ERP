/**
 * 拆柜账单 - 与发票管理同表头，按账单类型筛选
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { invoiceConfig } from "@/lib/crud/configs/invoices"

export default async function UnloadBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable
        config={invoiceConfig}
        initialFilterValues={{ invoice_type: "unload" }}
      />
    </DashboardLayout>
  )
}
