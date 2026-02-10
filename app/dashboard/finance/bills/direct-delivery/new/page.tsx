/**
 * 新建直送账单 - 第一步：填写主行（客户、订单、备注、状态），提交后跳转至详情页添加明细
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NewDirectDeliveryBillForm } from "../new-direct-delivery-form"

export default async function NewDirectDeliveryBillPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-2xl py-8">
        <h1 className="text-2xl font-semibold mb-6">新建直送账单</h1>
        <NewDirectDeliveryBillForm />
      </div>
    </DashboardLayout>
  )
}
