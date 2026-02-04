/**
 * 费用管理列表页（含批量导入）
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FeesPageClient } from "./fees-page-client"

export default async function FeesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <FeesPageClient />
    </DashboardLayout>
  )
}
