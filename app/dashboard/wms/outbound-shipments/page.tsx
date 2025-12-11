import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OutboundShipmentTable } from "./outbound-shipment-table"

export default async function OutboundShipmentsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <OutboundShipmentTable />
    </DashboardLayout>
  )
}

