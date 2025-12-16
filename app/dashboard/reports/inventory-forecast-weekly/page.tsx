import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InventoryForecastWeeklyClient } from "./inventory-forecast-weekly-client"

export default async function InventoryForecastWeeklyPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <InventoryForecastWeeklyClient />
    </DashboardLayout>
  )
}

