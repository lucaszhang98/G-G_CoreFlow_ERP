"use client"

/**
 * 海柜管理表格包装器
 * 使用 EntityTable 框架，但传入自定义列定义和自定义操作
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { EntityTable } from "@/components/crud/entity-table"
import { seaContainerConfig } from "@/lib/crud/configs/sea-containers"
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/utils"

interface SeaContainer {
  container_id: string
  container_number: string
  mbl: string | null
  port_location: string | null
  customer: string | null
  customer_code: string | null
  container_type: string | null
  carrier: string | null
  do_issued: boolean
  order_date: string | Date | null
  eta_date: string | Date | null
  operation_mode: string | null
  delivery_location: string | null
  lfd_date: string | Date | null
  pickup_date: string | Date | null
  return_date: string | Date | null
  appointment_number: string | null
  appointment_time: string | Date | null
  warehouse_account: string | null
  order_id: string | null
  order_number: string | null
  status: string | null
  created_at: string | Date | null
}

export function SeaContainerTableWrapper() {
  const router = useRouter()
  
  // 加载码头/查验站选项（用于筛选）
  const loadPortLocationFilterOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/tms/sea-containers/filter-options?type=port_location')
      if (!response.ok) {
        throw new Error('获取码头/查验站列表失败')
      }
      const options = await response.json()
      return options
    } catch (error) {
      console.error('加载码头/查验站筛选选项失败:', error)
      return []
    }
  }, [])

  // 加载承运公司选项（用于筛选）
  const loadCarrierFilterOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/tms/sea-containers/filter-options?type=carrier')
      if (!response.ok) {
        throw new Error('获取承运公司列表失败')
      }
      const options = await response.json()
      return options
    } catch (error) {
      console.error('加载承运公司筛选选项失败:', error)
      return []
    }
  }, [])

  // 加载操作方式选项（用于筛选）
  const loadOperationModeFilterOptions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/tms/sea-containers/filter-options?type=operation_mode')
      if (!response.ok) {
        throw new Error('获取操作方式列表失败')
      }
      const options = await response.json()
      return options
    } catch (error) {
      console.error('加载操作方式筛选选项失败:', error)
      return []
    }
  }, [])
  
  // 加载码头/查验站选项（用于可编辑单元格）
  const loadPortLocations = React.useCallback(async () => {
    try {
      const response = await fetch('/api/locations/ports')
      if (!response.ok) {
        throw new Error('获取码头/查验站列表失败')
      }
      const locations = await response.json()
      return locations.map((loc: any) => ({
        label: `${loc.name}${loc.location_code ? ` (${loc.location_code})` : ''}${loc.location_type === 'port' ? ' [码头]' : ' [查验站]'}`,
        value: String(loc.location_id),
      }))
    } catch (error) {
      console.error('加载码头/查验站选项失败:', error)
      return []
    }
  }, [])

  // 动态修改筛选字段配置，添加 loadOptions
  const enhancedConfig = React.useMemo(() => {
    const config = { ...seaContainerConfig }
    if (config.list.filterFields) {
      config.list.filterFields = config.list.filterFields.map((filter) => {
        if (filter.field === 'port_location') {
          return {
            ...filter,
            loadOptions: loadPortLocationFilterOptions,
          }
        }
        if (filter.field === 'carrier') {
          return {
            ...filter,
            loadOptions: loadCarrierFilterOptions,
          }
        }
        if (filter.field === 'operation_mode') {
          return {
            ...filter,
            loadOptions: loadOperationModeFilterOptions,
          }
        }
        return filter
      })
    }
    return config
  }, [loadPortLocationFilterOptions, loadCarrierFilterOptions, loadOperationModeFilterOptions])

  // 行级编辑的保存逻辑由 EntityTable 框架处理，这里不需要单独处理

  // 处理查看详情
  const handleView = React.useCallback((container: SeaContainer) => {
    if (container.order_id) {
      router.push(`/dashboard/oms/orders/${container.order_id}`)
    }
  }, [router])

  // 海柜管理不允许删除（数据来自订单管理）
  // const handleDelete = React.useCallback((container: SeaContainer) => {
  //   toast.error("删除功能暂未实现")
  // }, [])

  // 定义17列（不包含操作列，操作列由框架自动添加）
  // 注意：可编辑字段（port_location, eta_date, pickup_date, return_date, carrier, operation_mode）
  // 由框架的行级编辑功能处理，这里只需要定义显示格式
  const customColumns: ColumnDef<SeaContainer>[] = React.useMemo(() => {
    return [
      {
        accessorKey: "container_number",
        header: "柜号",
      },
      {
        accessorKey: "mbl",
        header: "MBL",
        cell: ({ row }) => <span>{row.original.mbl || "-"}</span>,
      },
      {
        accessorKey: "port_location",
        header: "码头/查验站",
        // 行级编辑时由框架自动处理，显示时直接显示文本
      },
      {
        accessorKey: "customer",
        header: "客户",
        cell: ({ row }) => row.original.customer || "-",
      },
      {
        accessorKey: "container_type",
        header: "柜型",
        cell: ({ row }) => <span>{row.original.container_type || "-"}</span>,
      },
      {
        accessorKey: "carrier",
        header: "承运公司",
        // 行级编辑时由框架自动处理，显示时直接显示文本
      },
      {
        accessorKey: "do_issued",
        header: "DO",
        cell: ({ row }) =>
          row.original.do_issued ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400" />
          ),
      },
      {
        accessorKey: "order_date",
        header: "订单日期",
        cell: ({ row }) => formatDateDisplay(row.original.order_date),
      },
      {
        accessorKey: "eta_date",
        header: "ETA",
        // 行级编辑时由框架自动处理，显示时由框架格式化
      },
      {
        accessorKey: "operation_mode",
        header: "操作方式",
        // 行级编辑时由框架自动处理，显示时直接显示文本
      },
      {
        accessorKey: "delivery_location",
        header: "送货地",
        cell: ({ row }) => <span>{row.original.delivery_location || "-"}</span>,
      },
      {
        accessorKey: "lfd_date",
        header: "LFD",
        cell: ({ row }) => formatDateDisplay(row.original.lfd_date),
      },
      {
        accessorKey: "pickup_date",
        header: "提柜日期",
        // 行级编辑时由框架自动处理，显示时由框架格式化
      },
      {
        accessorKey: "return_date",
        header: "还柜日期",
        // 行级编辑时由框架自动处理，显示时由框架格式化
      },
      {
        accessorKey: "appointment_number",
        header: "预约号码",
        cell: ({ row }) => row.original.appointment_number || "-",
      },
      {
        accessorKey: "appointment_time",
        header: "预约时间",
        cell: ({ row }) => formatDateTimeDisplay(row.original.appointment_time),
      },
      {
        accessorKey: "warehouse_account",
        header: "约仓账号",
        cell: ({ row }) => <span>{row.original.warehouse_account || "-"}</span>,
      },
    ]
  }, [])

  // 可排序列
  const customSortableColumns = [
    "container_number",
    "mbl",
    "customer",
    "container_type",
    "carrier",
    "order_date",
    "eta_date",
    "lfd_date",
    "pickup_date",
    "return_date",
    "appointment_time",
  ]

  // 列标签映射
  const customColumnLabels = {
    container_number: "柜号",
    mbl: "MBL",
    port_location: "码头/查验站",
    customer: "客户",
    container_type: "柜型",
    carrier: "承运公司",
    do_issued: "DO",
    order_date: "订单日期",
    eta_date: "ETA",
    operation_mode: "操作方式",
    delivery_location: "送货地",
    lfd_date: "LFD",
    pickup_date: "提柜日期",
    return_date: "还柜日期",
    appointment_number: "预约号码",
    appointment_time: "预约时间",
    warehouse_account: "约仓账号",
  }

  // 可点击列配置：柜号列可点击跳转到详情
  const customClickableColumns = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (container: SeaContainer) => {
        if (container.order_id) {
          handleView(container)
        } else {
          toast.error("无法查看详情：缺少订单ID")
        }
      },
      disabled: (container: SeaContainer) => !container.order_id,
      showIcon: true,
      bold: true,
      getTitle: (container: SeaContainer) =>
        container.order_id
          ? `点击查看订单详情 (订单ID: ${container.order_id})`
          : "无法查看详情：缺少订单ID",
    },
  ], [handleView])

  // 字段选项加载函数（用于行级编辑中的下拉菜单字段）
  const fieldLoadOptions = React.useMemo(() => ({
    port_location: loadPortLocationFilterOptions,
    carrier: loadCarrierFilterOptions,
    operation_mode: loadOperationModeFilterOptions,
  }), [loadPortLocationFilterOptions, loadCarrierFilterOptions, loadOperationModeFilterOptions])

  // 自定义保存处理函数（海柜管理使用特殊的更新API格式）
  const customSaveHandler = React.useCallback(async (container: SeaContainer, updates: Record<string, any>) => {
    if (!container.order_id) {
      throw new Error("无法保存：缺少订单ID")
    }

    // 海柜管理的更新API需要逐个字段更新
    const updatePromises = Object.entries(updates).map(async ([field, value]) => {
      const response = await fetch(`/api/tms/sea-containers/${container.container_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field,
          value,
          order_id: container.order_id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `更新字段 ${field} 失败`)
      }
    })

    await Promise.all(updatePromises)
  }, [])

  return (
    <EntityTable
      config={enhancedConfig}
      customColumns={customColumns}
      customActions={{
        onView: undefined, // 隐藏查看详情按钮（已有超链接）
        // 不提供 onDelete，海柜管理不允许删除（数据来自订单管理）
        // onDelete: handleDelete,
      }}
      customSortableColumns={customSortableColumns}
      customColumnLabels={customColumnLabels}
      customClickableColumns={customClickableColumns}
      fieldLoadOptions={fieldLoadOptions}
      customSaveHandler={customSaveHandler}
    />
  )
}

