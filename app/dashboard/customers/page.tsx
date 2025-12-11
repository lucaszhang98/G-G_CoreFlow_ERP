/**
 * 客户管理页面 - 使用通用框架
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { customerConfig } from "@/lib/crud/configs/customers"
import { CustomerForm } from "./customer-form"

export default async function CustomersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable config={customerConfig} FormComponent={CustomerForm} />
    </DashboardLayout>
  )
}
