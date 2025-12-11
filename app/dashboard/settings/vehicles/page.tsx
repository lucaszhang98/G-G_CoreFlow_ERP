/**
 * 车辆管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { vehicleConfig } from "@/lib/crud/configs/vehicles"

export default async function VehiclesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={vehicleConfig} />
    </DashboardLayout>
  )
}


