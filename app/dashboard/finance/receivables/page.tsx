/**
 * 应收管理列表页 - Phase 1 骨架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { receivableConfig } from "@/lib/crud/configs/receivables"

export default async function ReceivablesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={receivableConfig} />
    </DashboardLayout>
  )
}
