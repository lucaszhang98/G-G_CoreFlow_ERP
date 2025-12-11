import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InventoryForecastClient } from "./inventory-forecast-client"

export default async function InventoryForecastPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <InventoryForecastClient />
    </DashboardLayout>
  )
}
