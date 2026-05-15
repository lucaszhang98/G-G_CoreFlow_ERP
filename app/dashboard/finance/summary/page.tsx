/**
 * 财务汇总：仍有余额的客户 × 按发票开票月的应收余额矩阵
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { FinanceSummaryClient } from "./finance-summary-client"

export default async function FinanceSummaryPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-[100vw] py-8 px-4 md:max-w-7xl">
        <h1 className="text-2xl font-semibold mb-6">财务汇总</h1>
        <FinanceSummaryClient />
      </div>
    </DashboardLayout>
  )
}
