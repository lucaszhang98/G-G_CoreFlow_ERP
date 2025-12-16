/**
 * 位置管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LocationsPageClient } from "./locations-page-client"

export default async function LocationsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <LocationsPageClient />
    </DashboardLayout>
  )
}


