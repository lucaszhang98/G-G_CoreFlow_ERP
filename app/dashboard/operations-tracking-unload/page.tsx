/**
 * 运营追踪 - 拆柜页面
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OperationsTrackingClient } from "../operations-tracking/operations-tracking-client"

export default async function OperationsTrackingUnloadPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <OperationsTrackingClient operationMode="unload" title="运营追踪 - 拆柜" />
    </DashboardLayout>
  )
}

