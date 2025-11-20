import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingCart,
  Truck,
  Warehouse,
  TrendingUp,
  Package,
  ArrowRight,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity,
  BarChart3,
  FileText,
  Inbox,
  PackageCheck,
} from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // 获取统计数据（这里先使用模拟数据，后续可以连接真实API）
  const stats = await getDashboardStats()

  const quickActions = [
    {
      title: "创建新订单",
      description: "快速创建客户订单",
      icon: ShoppingCart,
      href: "/dashboard/oms/orders?action=create",
      color: "from-blue-500 to-blue-600",
      roles: ["admin", "oms_manager"],
    },
    {
      title: "安排运输",
      description: "创建运输任务",
      icon: Truck,
      href: "/dashboard/tms/containers?action=create",
      color: "from-green-500 to-green-600",
      roles: ["admin", "tms_manager"],
    },
    {
      title: "入库登记",
      description: "登记货物入库",
      icon: Inbox,
      href: "/dashboard/wms/inbound?action=create",
      color: "from-purple-500 to-purple-600",
      roles: ["admin", "wms_manager"],
    },
    {
      title: "出库管理",
      description: "处理出库单",
      icon: PackageCheck,
      href: "/dashboard/wms/outbound",
      color: "from-orange-500 to-orange-600",
      roles: ["admin", "wms_manager"],
    },
    {
      title: "客户管理",
      description: "管理客户信息",
      icon: Users,
      href: "/dashboard/customers",
      color: "from-indigo-500 to-indigo-600",
      roles: ["admin", "oms_manager"],
    },
    {
      title: "查看报表",
      description: "查看业务报表",
      icon: BarChart3,
      href: "/dashboard/reports/orders",
      color: "from-pink-500 to-pink-600",
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager"],
    },
  ]

  const recentActivities = [
    {
      type: "order",
      title: "新订单创建",
      description: "订单 #ORD-2025-001 已创建",
      time: "2分钟前",
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      type: "shipment",
      title: "运输任务完成",
      description: "容器 #CTN-001 已送达",
      time: "15分钟前",
      icon: Truck,
      color: "text-green-600",
    },
    {
      type: "inventory",
      title: "库存更新",
      description: "仓库 W001 库存已更新",
      time: "1小时前",
      icon: Warehouse,
      color: "text-purple-600",
    },
  ]

  const pendingTasks = [
    {
      title: "待确认订单",
      count: stats.pendingOrders,
      href: "/dashboard/oms/orders?status=pending",
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
    },
    {
      title: "运输中",
      count: stats.inTransit,
      href: "/dashboard/tms/containers?status=in_transit",
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "待入库",
      count: stats.pendingInbound,
      href: "/dashboard/wms/inbound?status=pending",
      icon: Inbox,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      title: "待出库",
      count: stats.pendingOutbound,
      href: "/dashboard/wms/outbound?status=pending",
      icon: PackageCheck,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
  ]

  const userRole = session.user?.role || "user"
  const filteredQuickActions = quickActions.filter(
    (action) => !action.roles || action.roles.includes(userRole)
  )

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="space-y-8">
        {/* 欢迎区域 */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            欢迎回来，{session.user?.name || session.user?.username} 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            这是您的系统概览，快速了解业务状态和待处理事项
          </p>
        </div>

        {/* 核心统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                今日订单
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">
                  {stats.ordersChange > 0 ? "+" : ""}
                  {stats.ordersChange}%
                </span>{" "}
                较昨日
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                运输中
              </CardTitle>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <Truck className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inTransit}</div>
              <p className="text-xs text-muted-foreground mt-1">
                正在运输的容器
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                库存总量
              </CardTitle>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <Warehouse className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInventory}</div>
              <p className="text-xs text-muted-foreground mt-1">
                所有仓库库存总和
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月营收
              </CardTitle>
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <DollarSign className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{stats.monthlyRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">
                  {stats.revenueChange > 0 ? "+" : ""}
                  {stats.revenueChange}%
                </span>{" "}
                较上月
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 待处理任务 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pendingTasks.map((task) => {
            const Icon = task.icon
            return (
              <Link key={task.title} href={task.href}>
                <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
                    <div className={`p-2 rounded-lg ${task.bgColor}`}>
                      <Icon className={`h-4 w-4 ${task.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{task.count}</div>
                    <p className="text-xs text-muted-foreground mt-1">需要处理</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 快速操作 */}
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快速入口</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.title} href={action.href}>
                      <Button
                        variant="outline"
                        className="w-full h-auto py-6 flex-col gap-3 hover:shadow-md transition-all"
                      >
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${action.color} shadow-lg`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{action.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {action.description}
                          </div>
                        </div>
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 最近活动 */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>系统最新动态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => {
                  const Icon = activity.icon
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-muted`}>
                        <Icon className={`h-4 w-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/dashboard/notifications">
                  查看全部
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 业务模块概览 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">业务模块</h2>
            <Badge variant="secondary">快速访问</Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Link href="/dashboard/oms/orders">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden h-full">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                      <ShoppingCart className="h-6 w-6 text-white" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="mt-4 text-xl">订单管理系统</CardTitle>
                  <CardDescription className="mt-2">
                    管理客户订单、订单详情和订单状态
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {stats.totalOrders} 个订单
                    </span>
                    <Badge variant="secondary">OMS</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/tms/containers">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden h-full">
                <div className="h-2 bg-gradient-to-r from-green-500 to-green-600" />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                      <Truck className="h-6 w-6 text-white" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="mt-4 text-xl">运输管理系统</CardTitle>
                  <CardDescription className="mt-2">
                    管理容器、运输路线和运输状态
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {stats.totalContainers} 个容器
                    </span>
                    <Badge variant="secondary">TMS</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/wms/inventory">
              <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden h-full">
                <div className="h-2 bg-gradient-to-r from-purple-500 to-purple-600" />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                      <Warehouse className="h-6 w-6 text-white" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="mt-4 text-xl">仓储管理系统</CardTitle>
                  <CardDescription className="mt-2">
                    管理入库、出库和库存信息
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {stats.totalWarehouses} 个仓库
                    </span>
                    <Badge variant="secondary">WMS</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

// 获取仪表盘统计数据
async function getDashboardStats() {
  try {
    // 这里可以连接真实的数据库查询
    // 目前先返回模拟数据
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      todayOrdersCount,
      totalOrdersCount,
      totalContainersCount,
      totalWarehousesCount,
      pendingOrdersCount,
      inTransitCount,
      pendingInboundCount,
      pendingOutboundCount,
    ] = await Promise.all([
      // 今日订单数
      prisma.orders.count({
        where: {
          order_date: {
            gte: today,
          },
        },
      }),
      // 总订单数
      prisma.orders.count(),
      // 总容器数（暂时使用0，等TMS模块实现后再连接真实数据）
      0,
      // 总仓库数
      prisma.warehouses.count(),
      // 待确认订单数
      prisma.orders.count({
        where: {
          status: "pending",
        },
      }),
      // 运输中容器数（暂时使用0，等TMS模块实现后再连接真实数据）
      0,
      // 待入库数（需要根据实际表结构调整）
      0,
      // 待出库数（需要根据实际表结构调整）
      0,
    ])

    return {
      todayOrders: todayOrdersCount,
      ordersChange: 0, // 需要计算昨日对比
      totalOrders: totalOrdersCount,
      inTransit: inTransitCount,
      totalInventory: 0, // 需要从 inventory_lots 表计算
      monthlyRevenue: 0, // 需要从订单表计算
      revenueChange: 0, // 需要计算上月对比
      totalContainers: totalContainersCount,
      totalWarehouses: totalWarehousesCount,
      pendingOrders: pendingOrdersCount,
      pendingInbound: pendingInboundCount,
      pendingOutbound: pendingOutboundCount,
    }
  } catch (error) {
    // 返回默认值
    return {
      todayOrders: 0,
      ordersChange: 0,
      totalOrders: 0,
      inTransit: 0,
      totalInventory: 0,
      monthlyRevenue: 0,
      revenueChange: 0,
      totalContainers: 0,
      totalWarehouses: 0,
      pendingOrders: 0,
      pendingInbound: 0,
      pendingOutbound: 0,
    }
  }
}
