/**
 * 运营追踪页面 - 重定向到拆柜页面
 */

import { redirect } from "next/navigation"

export default async function OperationsTrackingPage() {
  // 重定向到拆柜页面
  redirect("/dashboard/operations-tracking-unload")
}

