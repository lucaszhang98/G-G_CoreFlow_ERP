/**
 * 直送账单 - 主行+明细，新建两步：先建主行再添加明细
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DirectDeliveryBillTable } from "./direct-delivery-bill-table"

export default async function DirectDeliveryBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <DirectDeliveryBillTable />
    </DashboardLayout>
  )
}
