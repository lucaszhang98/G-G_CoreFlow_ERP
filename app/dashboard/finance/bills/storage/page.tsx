/**
 * 仓储账单 - 仅展示 storage；接口带 invoice_type 筛选，列表不展示账单类型筛选器
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { storageBillConfig } from "@/lib/crud/configs/invoices"

export default async function StorageBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable
        config={storageBillConfig}
        initialFilterValues={{ invoice_type: "storage" }}
      />
    </DashboardLayout>
  )
}
