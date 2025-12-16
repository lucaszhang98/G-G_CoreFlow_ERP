/**
 * 货柜管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TrailersPageClient } from "./trailers-page-client"

export default async function TrailersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <TrailersPageClient />
    </DashboardLayout>
  )
}


