import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityDetail } from "@/components/crud/entity-detail"
import { deliveryAppointmentConfig } from "@/lib/crud/configs/delivery-appointments"
import { AppointmentDetailClient } from "./appointment-detail-client"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"

interface AppointmentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = await params

  // 验证ID是否有效
  if (!resolvedParams.id || isNaN(Number(resolvedParams.id))) {
    notFound()
  }

  // 获取预约主行信息
  let appointment: any = null
  try {
    appointment = await prisma.delivery_appointments.findUnique({
      where: {
        appointment_id: BigInt(resolvedParams.id),
      },
      include: {
        orders: {
          select: {
            order_id: true,
            order_number: true,
            order_detail: {
              select: {
                id: true,
                estimated_pallets: true,
              },
            },
          },
        },
        locations: {
          select: {
            location_id: true,
            name: true,
            location_code: true,
          },
        },
        locations_delivery_appointments_origin_location_idTolocations: {
          select: {
            location_id: true,
            name: true,
            location_code: true,
          },
        },
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      notFound()
    }
    throw new Error(`获取预约详情失败: ${error?.message || '未知错误'}`)
  }

  if (!appointment) {
    notFound()
  }

  // 序列化数据
  const serializedAppointment = serializeBigInt(appointment)

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 预约主行信息 */}
            <EntityDetail
              config={deliveryAppointmentConfig}
              id={resolvedParams.id}
              data={serializedAppointment}
            />
            
            {/* 预约明细表格 */}
            <AppointmentDetailClient
              appointmentId={resolvedParams.id}
              appointment={serializedAppointment}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
