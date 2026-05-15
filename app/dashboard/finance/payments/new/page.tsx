import { redirect } from "next/navigation"

/** 新建收款已改为列表页弹窗；保留路由避免旧链接 404 */
export default function PaymentsNewRedirectPage() {
  redirect("/dashboard/finance/payments")
}
