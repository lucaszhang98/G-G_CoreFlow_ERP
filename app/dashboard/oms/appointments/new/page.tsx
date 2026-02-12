import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NewAppointmentFromDetailsClient } from "./new-appointment-from-details-client"

interface NewAppointmentPageProps {
  searchParams: Promise<{ order_detail_ids?: string }>
}

export default async function NewAppointmentPage({ searchParams }: NewAppointmentPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const params = await searchParams
  const idsParam = params.order_detail_ids ?? ""
  const orderDetailIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">新建预约</h1>
        <NewAppointmentFromDetailsClient orderDetailIds={orderDetailIds} />
      </div>
    </DashboardLayout>
  )
}
