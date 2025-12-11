/**
 * 库存管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InventoryLotTable } from "./inventory-lot-table"

export default async function InventoryLotsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <InventoryLotTable />
    </DashboardLayout>
  )
}

