/**
 * 应收管理列表页 - Phase 1 骨架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ReceivablesTableClient } from "./receivables-table-client"

export default async function ReceivablesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <ReceivablesTableClient />
    </DashboardLayout>
  )
}
