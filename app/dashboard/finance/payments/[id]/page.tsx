/**
 * 收款详情页 - Phase 1 全链条：基本信息 + 核销明细与添加核销
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityDetail } from "@/components/crud/entity-detail"
import { paymentConfig } from "@/lib/crud/configs/payments"
import { PaymentAllocationsCard } from "@/components/finance/payment-allocations-card"

interface PaymentDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = params instanceof Promise ? await params : params

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <EntityDetail
            config={paymentConfig}
            id={resolvedParams.id}
            rightCard={<PaymentAllocationsCard paymentId={resolvedParams.id} />}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
