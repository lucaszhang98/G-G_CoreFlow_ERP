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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState, useEffect, useMemo } from "react"

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

// 菜单项定义（移到组件外部）
const menuItems: MenuItem[] = [
  {
    title: "仪表盘",
    icon: LayoutDashboard,
    href: "/dashboard",
    roles: ["admin", "oms_manager", "tms_manager", "wms_manager", "employee", "user"],
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
      ],
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
        title: "海柜管理",
        icon: Container,
        href: "/dashboard/tms/sea-containers",
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
        icon: ClipboardList,
        href: "/dashboard/wms/inbound-receipts",
      },
      {
        title: "库存管理",
        icon: Package,
        href: "/dashboard/wms/inventory-lots",
      },
      {
        title: "出库管理",
        icon: PackageCheck,
        href: "/dashboard/wms/outbound-shipments",
      },
      {
        title: "劳动力管理",
        icon: Users2,
        href: "/dashboard/wms/labor",
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
    title: "系统设置",
    icon: Settings,
    roles: ["admin"],
    children: [
      {
        title: "系统配置",
        icon: Settings,
        href: "/dashboard/settings/system",
      },
      {
        title: "角色权限",
        icon: ClipboardCheck,
        href: "/dashboard/settings/roles",
      },
      {
        title: "操作日志",
        icon: FileCheck,
        href: "/dashboard/settings/logs",
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

// 从路径中提取模块标识（用于状态管理）
function getModuleFromPath(pathname: string): string | null {
  if (pathname === '/dashboard') return null
  if (pathname.startsWith('/dashboard/customers') || 
      pathname.startsWith('/dashboard/users') || 
      pathname.startsWith('/dashboard/warehouses') ||
      pathname.startsWith('/dashboard/settings/departments') ||
      pathname.startsWith('/dashboard/settings/locations') ||
      pathname.startsWith('/dashboard/settings/carriers') ||
      pathname.startsWith('/dashboard/settings/vehicles') ||
      pathname.startsWith('/dashboard/settings/trailers') ||
      pathname.startsWith('/dashboard/settings/drivers')) {
    return '基础数据'
  }
  if (pathname.startsWith('/dashboard/settings/system') ||
      pathname.startsWith('/dashboard/settings/roles') ||
      pathname.startsWith('/dashboard/settings/logs')) {
    return '系统设置'
  }
  if (pathname.startsWith('/dashboard/oms')) return '订单管理 (OMS)'
  if (pathname.startsWith('/dashboard/tms')) return '运输管理 (TMS)'
  if (pathname.startsWith('/dashboard/wms')) return '仓库管理 (WMS)'
  if (pathname.startsWith('/dashboard/reports')) return '报表分析'
  if (pathname.startsWith('/dashboard/documents') || 
      pathname.startsWith('/dashboard/tools') || 
      pathname.startsWith('/dashboard/help')) {
    return '工具'
  }
  return null
}

// 检查路径是否匹配菜单项或其子项
function isPathMatch(item: MenuItem, pathname: string): boolean {
  if (item.href && pathname === item.href) return true
  if (item.children) {
    return item.children.some(child => isPathMatch(child, pathname))
  }
  return false
}

// 递归查找包含当前路径的菜单项
function findActiveMenuItems(items: MenuItem[], pathname: string): string[] {
  const activeItems: string[] = []
  
  for (const item of items) {
    if (isPathMatch(item, pathname)) {
      activeItems.push(item.title)
      // 如果这个菜单项有子项，递归查找
      if (item.children) {
        activeItems.push(...findActiveMenuItems(item.children, pathname))
      }
    } else if (item.children) {
      // 即使当前项不匹配，也要检查子项
      const childActive = findActiveMenuItems(item.children, pathname)
      if (childActive.length > 0) {
        activeItems.push(item.title)
        activeItems.push(...childActive)
      }
    }
  }
  
  return activeItems
}

export function Sidebar({ userRole = "user" }: SidebarProps) {
  const pathname = usePathname()
  
  // 初始状态：只使用自动展开的菜单（确保服务器端和客户端一致）
  // 使用函数式初始化，基于当前 pathname 计算
  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    return findActiveMenuItems(menuItems, pathname)
  })
  
  // 从 localStorage 读取用户保存的展开状态（只在客户端挂载后执行）
  const [persistedOpenMenus, setPersistedOpenMenus] = useState<string[]>([])
  
  // 客户端挂载后，读取 localStorage 并合并状态（只执行一次）
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-open-menus')
      const savedMenus = saved ? JSON.parse(saved) : []
      setPersistedOpenMenus(savedMenus)
      
      // 合并自动展开和用户保存的状态
      const currentAutoOpen = findActiveMenuItems(menuItems, pathname)
      const merged = new Set([...currentAutoOpen, ...savedMenus])
      setOpenMenus(Array.from(merged))
    } catch {
      // 忽略存储错误，保持当前状态
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在挂载时执行一次
  
  // 当路径变化时，更新自动展开的菜单
  useEffect(() => {
    const newAutoOpen = findActiveMenuItems(menuItems, pathname)
    const currentModule = getModuleFromPath(pathname)
    
    // 如果切换到新模块，只展开新模块，折叠其他模块
    if (currentModule) {
      // 保留当前模块的展开状态，移除其他顶级模块
      const topLevelMenus = menuItems
        .filter(item => item.children && item.children.length > 0)
        .map(item => item.title)
      
      const otherModules = topLevelMenus.filter(menu => menu !== currentModule)
      
      setOpenMenus(prev => {
        // 移除其他模块，但保留当前模块和其子菜单
        const filtered = prev.filter(menu => !otherModules.includes(menu))
        // 添加当前模块的自动展开菜单，并合并用户保存的状态
        const merged = new Set([...filtered, ...newAutoOpen, ...persistedOpenMenus])
        return Array.from(merged)
      })
    } else {
      // 回到 dashboard，保持当前状态（不自动折叠）
      setOpenMenus(prev => {
        const merged = new Set([...prev, ...newAutoOpen, ...persistedOpenMenus])
        return Array.from(merged)
      })
    }
  }, [pathname, persistedOpenMenus])
  
  // 保存用户手动展开/折叠的状态到 localStorage
  const saveOpenMenus = (menus: string[]) => {
    setPersistedOpenMenus(menus)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sidebar-open-menus', JSON.stringify(menus))
      } catch {
        // 忽略存储错误
      }
    }
  }

  // 检查用户是否有权限访问菜单项
  const hasPermission = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true
    return roles.includes(userRole)
  }

  // 切换菜单展开/收起
  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => {
      const newMenus = prev.includes(title) 
        ? prev.filter((t) => t !== title) 
        : [...prev, title]
      
      // 保存用户手动操作的状态
      saveOpenMenus(newMenus)
      
      return newMenus
    })
  }

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    if (!hasPermission(item.roles)) return null

    const isActive = item.href && pathname === item.href
    const hasChildren = item.children && item.children.length > 0
    const isOpen = openMenus.includes(item.title)
    
    // 检查是否有子项处于激活状态
    const hasActiveChild = item.children?.some(child => {
      if (child.href && pathname === child.href) return true
      if (child.children) {
        return child.children.some(grandChild => grandChild.href && pathname === grandChild.href)
      }
      return false
    })

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
              isActive || hasActiveChild
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
            {item.children?.map((child) => renderMenuItem(child, level + 1))}
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
        {item.badge !== undefined && typeof item.badge === 'number' && item.badge > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
            {item.badge}
          </Badge>
        )}
      </Link>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background overflow-hidden" suppressHydrationWarning>
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
        <div className="space-y-1 p-4" suppressHydrationWarning>
          {menuItems.map((item) => renderMenuItem(item))}
        </div>
      </ScrollArea>
    </div>
  )
}
