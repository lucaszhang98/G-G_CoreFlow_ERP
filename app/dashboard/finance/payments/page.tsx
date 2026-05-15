/**
 * 收款管理列表页 - Phase 1 骨架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PaymentsPageClient } from "@/components/finance/payments-page-client"

export default async function PaymentsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <PaymentsPageClient />
    </DashboardLayout>
  )
}
