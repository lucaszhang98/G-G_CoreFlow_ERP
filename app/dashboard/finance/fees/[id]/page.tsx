/**
 * 费用详情页：基本信息 + 归属范围（scope_type=customers 时）
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityDetail } from "@/components/crud/entity-detail"
import { feeConfig } from "@/lib/crud/configs/fees"
import { FeeScopeCard } from "@/components/finance/fee-scope-card"

interface FeeDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function FeeDetailPage({ params }: FeeDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = await params

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <EntityDetail
            config={feeConfig}
            id={resolvedParams.id}
            rightCard={<FeeScopeCard feeId={resolvedParams.id} />}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
