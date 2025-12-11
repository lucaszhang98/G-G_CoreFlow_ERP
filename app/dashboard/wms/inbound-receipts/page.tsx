/**
 * 拆柜规划管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InboundReceiptTable } from "./inbound-receipt-table"

export default async function InboundReceiptsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <InboundReceiptTable />
    </DashboardLayout>
  )
}

