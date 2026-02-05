/**
 * 出库管理详情页：主行完整信息 + 对应预约的所有明细
 */

import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityDetail } from "@/components/crud/entity-detail"
import { outboundShipmentConfig } from "@/lib/crud/configs/outbound-shipments"
import { getOutboundShipmentDetail } from "@/lib/services/outbound-shipment-detail"
import { AppointmentDetailClient } from "@/app/dashboard/oms/appointments/[id]/appointment-detail-client"
import { OutboundPrintLoadingSheetButton } from "./outbound-print-loading-sheet-button"
import { OutboundPrintBOLButton } from "./outbound-print-bol-button"

interface OutboundShipmentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OutboundShipmentDetailPage({ params }: OutboundShipmentDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { id } = await params

  const data = await getOutboundShipmentDetail(id)
  if (!data) {
    notFound()
  }

  // 供预约明细表格使用的上下文（订单号、目的地等）
  const appointmentContext = {
    orders: { order_number: data.order_number ?? null },
    locations: { location_code: data.destination_location ?? null },
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 主行完整信息 */}
            <EntityDetail
              config={outboundShipmentConfig}
              id={id}
              data={data}
            />
            {/* 打印装车单、生成 BOL */}
            <div className="flex justify-end gap-2">
              <OutboundPrintLoadingSheetButton appointmentId={id} />
              <OutboundPrintBOLButton appointmentId={id} />
            </div>
            {/* 对应预约的所有明细 */}
            <AppointmentDetailClient
              appointmentId={id}
              appointment={appointmentContext}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
