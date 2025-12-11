/**
 * 提柜管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { pickupManagementConfig } from "@/lib/crud/configs/pickup-management"

export default async function PickupManagementPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={pickupManagementConfig} />
    </DashboardLayout>
  )
}

