/**
 * 送仓管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { deliveryManagementConfig } from "@/lib/crud/configs/delivery-management"

export default async function DeliveryManagementPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={deliveryManagementConfig} />
    </DashboardLayout>
  )
}

