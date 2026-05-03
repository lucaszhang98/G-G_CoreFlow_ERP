/**
 * 负数账单（invoice_type=penalty）- 金额可为负；新建仅按柜号弹窗创建
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PenaltyBillTable } from "./penalty-bill-table"

export default async function PenaltyBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <PenaltyBillTable />
    </DashboardLayout>
  )
}
