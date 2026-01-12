'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/crud/entity-table';
import { inventoryLotConfig } from '@/lib/crud/configs/inventory-lots';
import type { ClickableColumnConfig } from '@/lib/table/config';
import { ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatDateTime } from '@/lib/utils'

export function InventoryLotTable() {
  const router = useRouter();
  
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (row: any) => {
        if (row.order_id) {
          router.push(`/dashboard/oms/orders/${row.order_id}`);
        }
      },
      disabled: (row: any) => !row.order_id,
      showIcon: true,
      bold: true,
      getTitle: (row: any) =>
        row.order_id
          ? `点击查看订单详情 (订单ID: ${row.order_id})`
          : "无法查看详情：缺少订单ID",
    },
  ], [router]);

  // 获取送仓预约数据（通过 order_detail.appointment_detail_lines）
  const getDeliveryAppointments = (row: any) => {
    if (!row.order_detail?.appointment_detail_lines) {
      return []
    }
    // 从 appointment_detail_lines 提取预约信息
    return row.order_detail.appointment_detail_lines
      .map((line: any) => ({
        appointment_id: line.delivery_appointments?.appointment_id?.toString() || null,
        reference_number: line.delivery_appointments?.reference_number || null,
        confirmed_start: line.delivery_appointments?.confirmed_start || null,
        location_id: line.delivery_appointments?.location_id?.toString() || null,
        status: line.delivery_appointments?.status || null,
        order_id: line.delivery_appointments?.order_id?.toString() || null,
        estimated_pallets: line.estimated_pallets || 0,
      }))
      .filter((appt: any) => appt.appointment_id !== null) // 过滤掉无效的预约
  }

  // 格式化日期（送仓日隐藏年份，只显示月-日）
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "-"
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${month}-${day}`
    } catch {
      return "-"
    }
  }

  // 格式化数字（与入库管理保持一致）
  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-"
    return num.toLocaleString()
  }

  // 格式化整数（用于板数相关字段）
  const formatInteger = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-"
    return Math.round(num).toLocaleString()
  }

  // 隐藏查看详情、删除和新建按钮（库存都是自动来的）
  const customActions = React.useMemo(() => ({
    onView: null, // 隐藏查看详情按钮（null 表示隐藏）
    onDelete: undefined, // 隐藏删除按钮
    onAdd: undefined, // 隐藏新建按钮
  }), [])

  return (
    <EntityTable
      config={inventoryLotConfig}
      customClickableColumns={customClickableColumns}
      customActions={customActions}
      expandableRows={{
        enabled: true,
        getExpandedContent: (row: any) => {
          const appointments = getDeliveryAppointments(row)
          
          if (appointments.length === 0) {
            return (
              <div className="p-4">
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无送仓预约
                </p>
              </div>
            )
          }

          return (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">
                  送仓预约 ({appointments.length})
                </h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>送仓预约</TableHead>
                    <TableHead>预约号码</TableHead>
                    <TableHead>送仓日</TableHead>
                    <TableHead>板数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt: any, index: number) => (
                    <TableRow key={appt.appointment_id || `appt-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {appt.reference_number ? (
                          <a 
                            href="#" 
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault()
                              // TODO: 后续添加链接目标
                            }}
                          >
                            {appt.reference_number}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(appt.confirmed_start)}</TableCell>
                      <TableCell>
                        {formatInteger(appt.estimated_pallets)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        },
      }}
    />
  );
}

