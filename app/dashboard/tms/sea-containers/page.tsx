/**
 * 海柜管理页面
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SeaContainerTableWrapper } from "./sea-container-table-wrapper"

export default async function SeaContainersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <SeaContainerTableWrapper />
        </div>
      </div>
    </DashboardLayout>
  )
}

