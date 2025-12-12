/**
 * OMS 订单明细页面 - 显示所有订单明细（已入库 + 未入库）
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OrderDetailTable } from "./order-detail-table"

export default async function OrderDetailsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <OrderDetailTable />
    </DashboardLayout>
  )
}

