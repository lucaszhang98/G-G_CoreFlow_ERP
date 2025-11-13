/**
 * 客户管理页面示例
 * 展示如何使用 Server Components 和 Client Components 结合
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CustomersTable } from "./customers-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function CustomersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // 获取客户列表（Server Component 直接查询数据库）
  const response = await fetch(
    `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/customers?page=1&pageSize=10`,
    {
      cache: "no-store", // 不缓存，每次请求最新数据
    }
  )

  const result = await response.json()
  const customers = result.data || []
  const pagination = result.pagination || { page: 1, pageSize: 10, total: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">
            管理所有客户信息，查看客户订单历史
          </p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建客户
          </Button>
        </Link>
      </div>

      <CustomersTable initialData={customers} pagination={pagination} />
    </div>
  )
}

