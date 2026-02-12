'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/crud/entity-table';
import { orderDetailConfig } from '@/lib/crud/configs/order-details';
import type { ClickableColumnConfig } from '@/lib/table/config';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Copy, CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { NewAppointmentDialog } from "./new-appointment-dialog"

export function OrderDetailTable() {
  const router = useRouter();
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [newAppointmentOpen, setNewAppointmentOpen] = React.useState(false);
  
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (row: any) => {
        if (row.order_id) {
          router.push(`/dashboard/oms/orders/${row.order_id}`);
        }
      },
      disabled: (row: any) => !row.order_id || !row.container_number,
      showIcon: true,
      bold: true,
      getTitle: (row: any) =>
        row.order_id && row.container_number
          ? `点击查看订单详情 (订单ID: ${row.order_id})`
          : "无法查看详情：缺少订单ID或柜号",
    },
  ], [router]);

  // 获取送仓预约数据
  const getDeliveryAppointments = (row: any) => {
    return row.appointments || []
  }

  // 格式化日期（送仓日隐藏年份，只显示月-日）
  const formatDate = (dateString: string | null | undefined) => {
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

  // 隐藏查看详情、删除和新建按钮（订单明细是自动来的）
  const customActions = React.useMemo(() => ({
    onView: null, // 隐藏查看详情按钮（null 表示隐藏）
    onDelete: undefined, // 隐藏删除按钮
    onAdd: undefined, // 隐藏新建按钮
  }), [])

  // 复制柜号功能
  const handleCopyContainerNumbers = React.useCallback((format: 'line' | 'comma' | 'space') => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有柜号（按选中顺序）
    const containerNumbers = selectedRows
      .map((row: any) => row.container_number)
      .filter(Boolean) // 过滤掉空值

    if (containerNumbers.length === 0) {
      toast.error('选中的记录中没有柜号')
      return
    }

    // 根据格式拼接
    let textToCopy = ''
    switch (format) {
      case 'line':
        textToCopy = containerNumbers.join('\n')
        break
      case 'comma':
        textToCopy = containerNumbers.join(', ')
        break
      case 'space':
        textToCopy = containerNumbers.join(' ')
        break
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${containerNumbers.length} 个柜号到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 复制未约板数功能
  const handleCopyUnbookedPallets = React.useCallback((format: 'line' | 'comma' | 'space') => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有未约板数（按选中顺序）
    const unbookedPallets = selectedRows
      .map((row: any) => {
        const unbooked = row.unbooked_pallets
        // 如果未约板数为 null 或 undefined，返回空字符串，后续会被过滤
        return unbooked !== null && unbooked !== undefined ? String(unbooked) : null
      })
      .filter((val): val is string => val !== null) // 过滤掉空值

    if (unbookedPallets.length === 0) {
      toast.error('选中的记录中没有未约板数')
      return
    }

    // 根据格式拼接
    let textToCopy = ''
    switch (format) {
      case 'line':
        textToCopy = unbookedPallets.join('\n')
        break
      case 'comma':
        textToCopy = unbookedPallets.join(', ')
        break
      case 'space':
        textToCopy = unbookedPallets.join(' ')
        break
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${unbookedPallets.length} 个未约板数到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 计算选中行的未约板数合计
  const totalUnbookedPallets = React.useMemo(() => {
    return selectedRows.reduce((sum, row) => {
      const unbooked = row.unbooked_pallets
      // 如果未约板数为 null 或 undefined，视为 0
      const value = unbooked !== null && unbooked !== undefined ? Number(unbooked) : 0
      return sum + (isNaN(value) ? 0 : value)
    }, 0)
  }, [selectedRows])

  // 新建预约：打开弹窗，带入勾选的明细
  const handleNewAppointment = React.useCallback(() => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要预约的明细行')
      return
    }
    setNewAppointmentOpen(true)
  }, [selectedRows])

  // 自定义批量操作按钮
  const customBatchActions = React.useMemo(() => {
    return (
      <>
        {/* 新建预约 */}
        <Button
          variant="default"
          size="sm"
          className="min-w-[100px] h-9 bg-indigo-600 hover:bg-indigo-700"
          disabled={selectedRows.length === 0}
          onClick={handleNewAppointment}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          新建预约
        </Button>
        {/* 显示合计未约板数 */}
        {selectedRows.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              合计未约板数：
            </span>
            <span className="text-sm text-blue-900 dark:text-blue-100 font-bold">
              {formatInteger(totalUnbookedPallets)}
            </span>
          </div>
        )}
        {/* 复制柜号下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[100px] h-9"
              disabled={selectedRows.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制柜号
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>选择复制格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleCopyContainerNumbers('line')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">换行分隔</span>
                <span className="text-xs text-muted-foreground">每个柜号一行</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyContainerNumbers('comma')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">逗号分隔</span>
                <span className="text-xs text-muted-foreground">A, B, C</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyContainerNumbers('space')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">空格分隔</span>
                <span className="text-xs text-muted-foreground">A B C</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 复制未约板数下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[120px] h-9"
              disabled={selectedRows.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制未约板数
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>选择复制格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleCopyUnbookedPallets('line')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">换行分隔</span>
                <span className="text-xs text-muted-foreground">每个数值一行</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyUnbookedPallets('comma')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">逗号分隔</span>
                <span className="text-xs text-muted-foreground">1, 2, 3</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyUnbookedPallets('space')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">空格分隔</span>
                <span className="text-xs text-muted-foreground">1 2 3</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )
  }, [selectedRows, handleCopyContainerNumbers, handleCopyUnbookedPallets, totalUnbookedPallets, handleNewAppointment])

  return (
    <>
    <EntityTable
      config={orderDetailConfig}
      customClickableColumns={customClickableColumns}
      customActions={customActions}
      customBatchActions={customBatchActions}
      onRowSelectionChange={setSelectedRows}
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
                    <TableHead>序号</TableHead>
                    <TableHead>预约号码</TableHead>
                    <TableHead>送仓日</TableHead>
                    <TableHead>预计板数</TableHead>
                    <TableHead>拒收板数</TableHead>
                    <TableHead>有效板数</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt: any, index: number) => {
                    const rej = appt.rejected_pallets ?? 0
                    const est = appt.estimated_pallets ?? 0
                    const effective = Math.max(0, est - rej)
                    return (
                      <TableRow key={appt.appointment_id || index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          {appt.reference_number ? (
                            <a 
                              href="#" 
                              className="text-blue-600 hover:underline"
                              onClick={(e) => {
                                e.preventDefault()
                                if (appt.appointment_id) {
                                  router.push(`/dashboard/oms/appointments/${appt.appointment_id}`);
                                }
                              }}
                            >
                              {appt.reference_number}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{formatDate(appt.confirmed_start)}</TableCell>
                        <TableCell>{formatInteger(est)}</TableCell>
                        <TableCell>{formatInteger(rej)}</TableCell>
                        <TableCell>{formatInteger(effective)}</TableCell>
                        <TableCell>
                          <Badge variant={appt.status === 'confirmed' ? 'default' : 'secondary'}>
                            {appt.status === 'confirmed' ? '已确认' : appt.status || '待确认'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        },
      }}
    />
    <NewAppointmentDialog
      open={newAppointmentOpen}
      onOpenChange={setNewAppointmentOpen}
      selectedRows={selectedRows}
    />
    </>
  );
}

