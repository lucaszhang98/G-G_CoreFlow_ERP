/**
 * 送仓管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DeliveryManagementClient } from "./delivery-management-client"

export default async function DeliveryManagementPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <DeliveryManagementClient />
    </DashboardLayout>
  )
}

