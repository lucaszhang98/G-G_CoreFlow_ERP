"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Warehouse,
  Users,
  User,
  Building2,
  Settings,
  FileText,
  BarChart3,
  Bell,
  HelpCircle,
  ChevronRight,
  Package2,
  Calendar,
  ListChecks,
  ClipboardList,
  Container,
  Route,
  Receipt,
  Inbox,
  Package,
  PackageCheck,
  Users2,
  MapPin,
  TruckIcon,
  Car,
  ClipboardCheck,
  UserCog,
  FileCheck,
  Download,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState } from "react"

interface SidebarProps {
  userRole?: string
}

interface MenuItem {
  title: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  badge?: string | number
  children?: MenuItem[]
  roles?: string[] // 允许访问的角色
}

export function Sidebar({ userRole = "user" }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState<string[]>([])

  // 检查用户是否有权限访问菜单项
  const hasPermission = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true
    return roles.includes(userRole)
  }

  // 切换菜单展开/收起
  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    )
  }

  const menuItems: MenuItem[] = [
    {
      title: "仪表盘",
      icon: LayoutDashboard,
      href: "/dashboard",
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
    },
    {
      title: "订单管理 (OMS)",
      icon: ShoppingCart,
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
      children: [
        {
          title: "订单管理",
          icon: FileText,
          href: "/dashboard/oms/orders",
        },
        {
          title: "预约管理",
          icon: Calendar,
          href: "/dashboard/oms/appointments",
        },
        {
          title: "订单分配",
          icon: ListChecks,
          href: "/dashboard/oms/allocations",
        },
        {
          title: "订单需求",
          icon: ClipboardList,
          href: "/dashboard/oms/requirements",
        },
      ],
    },
    {
      title: "运输管理 (TMS)",
      icon: Truck,
      roles: ["admin", "tms_manager", "oms_manager", "wms_manager", "employee", "user"],
      children: [
        {
          title: "容器管理",
          icon: Container,
          href: "/dashboard/tms/containers",
        },
        {
          title: "运输段管理",
          icon: Route,
          href: "/dashboard/tms/legs",
        },
        {
          title: "运费单管理",
          icon: Receipt,
          href: "/dashboard/tms/freight-bills",
        },
      ],
    },
    {
      title: "仓库管理 (WMS)",
      icon: Warehouse,
      roles: ["admin", "wms_manager", "oms_manager", "tms_manager", "employee", "user"],
      children: [
        {
          title: "入库管理",
          icon: Inbox,
          href: "/dashboard/wms/inbound",
        },
        {
          title: "库存管理",
          icon: Package,
          href: "/dashboard/wms/inventory",
        },
        {
          title: "出库管理",
          icon: PackageCheck,
          href: "/dashboard/wms/outbound",
        },
        {
          title: "劳动力管理",
          icon: Users2,
          href: "/dashboard/wms/labor",
        },
      ],
    },
    {
      title: "基础数据",
      icon: Package2,
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
      children: [
        {
          title: "客户管理",
          icon: Users,
          href: "/dashboard/customers",
        },
        {
          title: "用户管理",
          icon: User,
          href: "/dashboard/users",
          roles: ["admin"],
        },
        {
          title: "仓库管理",
          icon: Building2,
          href: "/dashboard/warehouses",
        },
        {
          title: "系统设置",
          icon: Settings,
          href: "/dashboard/settings",
          children: [
            {
              title: "部门管理",
              icon: Building2,
              href: "/dashboard/settings/departments",
            },
            {
              title: "位置管理",
              icon: MapPin,
              href: "/dashboard/settings/locations",
            },
            {
              title: "承运商管理",
              icon: TruckIcon,
              href: "/dashboard/settings/carriers",
            },
            {
              title: "车辆管理",
              icon: Car,
              href: "/dashboard/settings/vehicles",
            },
            {
              title: "货柜管理",
              icon: Container,
              href: "/dashboard/settings/trailers",
            },
            {
              title: "司机管理",
              icon: UserCog,
              href: "/dashboard/settings/drivers",
            },
            {
              title: "系统配置",
              icon: Settings,
              href: "/dashboard/settings/system",
              roles: ["admin"],
            },
            {
              title: "角色权限",
              icon: ClipboardCheck,
              href: "/dashboard/settings/roles",
              roles: ["admin"],
            },
            {
              title: "操作日志",
              icon: FileCheck,
              href: "/dashboard/settings/logs",
              roles: ["admin"],
            },
          ],
        },
      ],
    },
    {
      title: "报表分析",
      icon: BarChart3,
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
      children: [
        {
          title: "订单报表",
          icon: FileText,
          href: "/dashboard/reports/orders",
        },
        {
          title: "库存报表",
          icon: Package,
          href: "/dashboard/reports/inventory",
        },
        {
          title: "运输报表",
          icon: Truck,
          href: "/dashboard/reports/transportation",
        },
        {
          title: "财务报表",
          icon: Receipt,
          href: "/dashboard/reports/financial",
          roles: ["admin"],
        },
      ],
    },
    {
      title: "工具",
      icon: Settings,
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager"],
      children: [
        {
          title: "文档管理",
          icon: FileText,
          href: "/dashboard/documents",
        },
        {
          title: "数据导入导出",
          icon: Download,
          href: "/dashboard/tools/import-export",
        },
        {
          title: "系统帮助",
          icon: HelpCircle,
          href: "/dashboard/help",
        },
      ],
    },
    {
      title: "通知",
      icon: Bell,
      href: "/dashboard/notifications",
      badge: 0,
      roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
    },
  ]

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    if (!hasPermission(item.roles)) return null

    const isActive = item.href && pathname === item.href
    const hasChildren = item.children && item.children.length > 0
    const isOpen = openMenus.includes(item.title)

    if (hasChildren) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
        >
          <CollapsibleTrigger
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              level > 0 && "ml-4",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "transform rotate-90"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {item.children.map((child) => renderMenuItem(child, level + 1))}
          </CollapsibleContent>
        </Collapsible>
      )
    }

    return (
      <Link
        key={item.title}
        href={item.href || "#"}
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          level > 0 && "ml-4",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </div>
        {item.badge !== undefined && item.badge > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
            {item.badge}
          </Badge>
        )}
      </Link>
    )
  }

  return (
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
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="space-y-1 p-4">
          {menuItems.map((item) => renderMenuItem(item))}
        </div>
      </ScrollArea>
    </div>
  )
}

