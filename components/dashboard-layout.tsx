"use client"

import { signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, LogOut, Bell, Package2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useState, useEffect } from "react"

// 动态导入 Sidebar，禁用 SSR 以避免 Radix UI 的 hydration 错误
const Sidebar = dynamic(() => import("@/components/sidebar").then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-64 flex-col border-r bg-background overflow-hidden">
      <div className="flex h-16 items-center border-b px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
            <Package2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            CoreFlow ERP
          </span>
        </div>
      </div>
    </div>
  )
})

interface DashboardLayoutProps {
  children: React.ReactNode
  user: {
    name?: string | null
    username?: string
    role?: string
  }
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 只在客户端渲染 Sheet，避免 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background" suppressHydrationWarning>
      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:flex h-full">
        <Sidebar userRole={user.role || "user"} />
      </aside>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* 左侧：移动端菜单按钮 */}
            <div className="flex items-center gap-4">
              {/* 移动端侧边栏 - 只在客户端渲染以避免 hydration 错误 */}
              {mounted ? (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <Sidebar userRole={user.role || "user"} />
                  </SheetContent>
                </Sheet>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}

              {/* 面包屑导航（可选） */}
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {pathname === "/dashboard" ? "仪表盘" : getPageTitle(pathname)}
                </span>
              </div>
            </div>

            {/* 右侧：用户信息和操作 */}
            <div className="flex items-center gap-4">
              {/* 通知按钮 */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>

              {/* 用户信息 */}
              <div className="hidden sm:flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    {user.name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.name || user.username}</span>
                  {user.role && (
                    <Badge variant="secondary" className="w-fit text-xs mt-0.5">
                      {user.role}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 退出按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="hover:bg-red-50 dark:hover:bg-red-900/20"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// 根据路径获取页面标题
function getPageTitle(pathname: string): string {
  const titleMap: Record<string, string> = {
    "/dashboard": "仪表盘",
    "/dashboard/customers": "客户管理",
    "/dashboard/users": "用户管理",
    "/dashboard/warehouses": "仓库管理",
    "/dashboard/oms/orders": "订单管理",
    "/dashboard/oms/appointments": "预约管理",
    "/dashboard/tms/sea-containers": "海柜管理",
    "/dashboard/tms/containers": "容器管理",
    "/dashboard/wms/inbound": "入库管理",
    "/dashboard/wms/inventory": "库存管理",
    "/dashboard/wms/outbound": "出库管理",
    "/dashboard/wms/inbound-receipts": "入库管理",
    "/dashboard/settings": "系统设置",
    "/dashboard/reports/orders": "订单报表",
    "/dashboard/reports/inventory": "库存报表",
    "/dashboard/reports/transportation": "运输报表",
    "/dashboard/reports/financial": "财务报表",
    "/dashboard/notifications": "通知",
    "/dashboard/documents": "文档管理",
    "/dashboard/tools/import-export": "数据导入导出",
    "/dashboard/help": "系统帮助",
  }

  // 尝试精确匹配
  if (titleMap[pathname]) {
    return titleMap[pathname]
  }

  // 尝试前缀匹配
  for (const [path, title] of Object.entries(titleMap)) {
    if (pathname.startsWith(path)) {
      return title
    }
  }

  return "页面"
}
