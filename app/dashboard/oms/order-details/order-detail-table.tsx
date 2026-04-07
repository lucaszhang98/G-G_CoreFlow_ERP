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
import { Copy, CalendarPlus, CalendarCheck, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { NewAppointmentDialog } from "./new-appointment-dialog"
import { AddToExistingAppointmentDialog } from "./add-to-existing-appointment-dialog"
import { IncludeArchivedOrdersToggle } from "@/components/order-visibility/include-archived-toggle"
import { RemainingPalletsInlineCell } from "./remaining-pallets-inline-cell"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const EMPTY_EXTRA_LIST_PARAMS: Record<string, string> = {}

/** 关闭通用行内编辑（避免误调不存在的 /api/oms/order-details/:id）；实际板数用专用内联格 */
const orderDetailListConfig = {
  ...orderDetailConfig,
  list: {
    ...orderDetailConfig.list,
    inlineEdit: { enabled: false as const },
  },
}

export function OrderDetailTable() {
  const router = useRouter();
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const [tableRefreshKey, setTableRefreshKey] = React.useState(0)
  const extraListParams = React.useMemo(
    () => (includeArchived ? { includeArchived: "true" } : EMPTY_EXTRA_LIST_PARAMS),
    [includeArchived]
  )

  const [palletDrafts, setPalletDrafts] = React.useState<
    Record<string, { remaining: number; unbooked: number }>
  >({})
  const palletDraftsRef = React.useRef(palletDrafts)
  React.useEffect(() => {
    palletDraftsRef.current = palletDrafts
  }, [palletDrafts])

  const [navGuardOpen, setNavGuardOpen] = React.useState(false)
  const navResolveRef = React.useRef<((ok: boolean) => void) | null>(null)

  const ensurePalletDraft = React.useCallback((row: any) => {
    const lotId = row.inventory_lot_id as string | null | undefined
    if (!lotId) return
    setPalletDrafts((prev) => {
      if (prev[lotId]) return prev
      const remaining = Math.round(Number(row.remaining_pallets ?? 0))
      const unbooked = Math.round(Number(row.unbooked_pallets ?? 0))
      return { ...prev, [lotId]: { remaining, unbooked } }
    })
  }, [])

  const [savingPallets, setSavingPallets] = React.useState(false)

  const savePalletDraftsToServer = React.useCallback(async () => {
    const entries = Object.entries(palletDraftsRef.current)
    if (entries.length === 0) return true
    setSavingPallets(true)
    try {
      const res = await fetch("/api/oms/order-details/batch-save-pallet-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: entries.map(([inventory_lot_id, v]) => ({
            inventory_lot_id,
            remaining_pallet_count: v.remaining,
            unbooked_pallet_count: v.unbooked,
            pallet_counts_verified: true as const,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "保存失败")
      }
      setPalletDrafts({})
      toast.success(`已保存 ${entries.length} 条库存板数修改`)
      setTableRefreshKey((k) => k + 1)
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败")
      return false
    } finally {
      setSavingPallets(false)
    }
  }, [])

  const finishNavGuard = React.useCallback((ok: boolean) => {
    const r = navResolveRef.current
    navResolveRef.current = null
    setNavGuardOpen(false)
    r?.(ok)
  }, [])

  const paginationChangeGuard = React.useMemo(
    () => ({
      shouldIntercept: () => Object.keys(palletDraftsRef.current).length > 0,
      confirm: (_intent: { nextPage: number; nextPageSize: number }) =>
        new Promise<boolean>((resolve) => {
          navResolveRef.current = resolve
          setNavGuardOpen(true)
        }),
    }),
    []
  )

  React.useEffect(() => {
    if (Object.keys(palletDrafts).length === 0) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [palletDrafts])

  const customCellRenderers = React.useMemo(
    () => ({
      unbooked_pallets: ({ row }: { row: { original: Record<string, unknown> } }) => {
        const r = row.original as any
        const lotId = r.inventory_lot_id as string | undefined
        const d = lotId ? palletDrafts[lotId] : undefined
        const raw = d ? d.unbooked : r.unbooked_pallets
        const numValue =
          typeof raw === "number" ? raw : raw !== null && raw !== undefined ? parseFloat(String(raw)) : null
        const isNegative = numValue !== null && !Number.isNaN(numValue) && numValue < 0
        return (
          <div className={isNegative ? "text-red-600 font-semibold tabular-nums" : "tabular-nums"}>
            {numValue !== null && !Number.isNaN(numValue) ? numValue.toLocaleString() : "-"}
          </div>
        )
      },
      remaining_pallets: ({ row }: { row: { original: Record<string, unknown> } }) => {
        const r = row.original as any
        const lotId = r.inventory_lot_id as string | undefined
        return (
          <RemainingPalletsInlineCell
            row={r}
            draft={lotId ? palletDrafts[lotId] ?? null : null}
            onEnsureDraft={() => ensurePalletDraft(r)}
            onRemainingChange={(n) => {
              if (!lotId) return
              setPalletDrafts((prev) => {
                const base =
                  prev[lotId] ?? {
                    remaining: Math.round(Number(r.remaining_pallets ?? 0)),
                    unbooked: Math.round(Number(r.unbooked_pallets ?? 0)),
                  }
                return { ...prev, [lotId]: { ...base, remaining: n } }
              })
            }}
          />
        )
      },
      pallet_counts_verified: ({ row }: { row: { original: Record<string, unknown> } }) => {
        const r = row.original as any
        const lotId = r.inventory_lot_id as string | undefined
        const pending = lotId && palletDrafts[lotId]
        if (pending) {
          return (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">待保存·已校验</span>
          )
        }
        const ok = r.pallet_counts_verified === true
        return (
          <div className="flex items-center justify-center gap-1">
            {ok ? (
              <CheckCircle className="h-4 w-4 text-green-600" aria-label="已校验" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" aria-label="未校验" />
            )}
          </div>
        )
      },
    }),
    [palletDrafts, ensurePalletDraft]
  )
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [newAppointmentOpen, setNewAppointmentOpen] = React.useState(false);
  const [addToExistingAppointmentOpen, setAddToExistingAppointmentOpen] = React.useState(false);
  
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

  // 格式化日期（送仓日隐藏年份，只显示月/日）
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "-"
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${month}/${day}`
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

  // 复制预约号码功能
  const handleCopyAppointmentNumbers = React.useCallback((format: 'line' | 'comma' | 'space') => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有预约号码（按选中行的顺序，保持每个行内预约的顺序，不去重）
    const appointmentNumbers: string[] = []
    
    selectedRows.forEach((row: any) => {
      const appointments = row.appointments || []
      appointments.forEach((appt: any) => {
        if (appt.reference_number) {
          appointmentNumbers.push(appt.reference_number)
        }
      })
    })

    if (appointmentNumbers.length === 0) {
      toast.error('选中的记录中没有预约号码')
      return
    }

    // 根据格式拼接
    let textToCopy = ''
    switch (format) {
      case 'line':
        textToCopy = appointmentNumbers.join('\n')
        break
      case 'comma':
        textToCopy = appointmentNumbers.join(', ')
        break
      case 'space':
        textToCopy = appointmentNumbers.join(' ')
        break
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${appointmentNumbers.length} 个预约号码到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 批量复制PO功能
  const handleCopyPO = React.useCallback(() => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有PO字段（按选中顺序，每行的PO用换行分隔）
    const poValues: string[] = []
    
    selectedRows.forEach((row: any) => {
      const po = row.po
      if (po && po.trim()) {
        // PO字段可能包含多行（用换行符分隔），直接使用
        poValues.push(po.trim())
      }
    })

    if (poValues.length === 0) {
      toast.error('选中的记录中没有PO数据')
      return
    }

    // 用换行符连接所有PO
    const textToCopy = poValues.join('\n')

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${poValues.length} 个PO到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 批量复制FBA功能（提取##之前的部分）
  const handleCopyFBA = React.useCallback(() => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有FBA字段中##之前的部分
    const fbaValues: string[] = []
    
    selectedRows.forEach((row: any) => {
      const fba = row.fba
      if (fba && fba.trim()) {
        // FBA字段格式：FBA1##数量1\nFBA2##数量2
        // 需要提取每行##之前的部分
        const lines = fba.split('\n')
        lines.forEach((line: string) => {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            // 提取##之前的部分
            const parts = trimmedLine.split('##')
            if (parts.length > 0 && parts[0].trim()) {
              fbaValues.push(parts[0].trim())
            }
          }
        })
      }
    })

    if (fbaValues.length === 0) {
      toast.error('选中的记录中没有FBA数据')
      return
    }

    // 用换行符连接所有FBA
    const textToCopy = fbaValues.join('\n')

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${fbaValues.length} 个FBA到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 批量复制箱数功能（提取##之后的部分）
  const handleCopyQuantity = React.useCallback(() => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有FBA字段中##之后的部分（箱数）
    const quantityValues: string[] = []
    
    selectedRows.forEach((row: any) => {
      const fba = row.fba
      if (fba && fba.trim()) {
        // FBA字段格式：FBA1##数量1\nFBA2##数量2
        // 需要提取每行##之后的部分
        const lines = fba.split('\n')
        lines.forEach((line: string) => {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            // 提取##之后的部分
            const parts = trimmedLine.split('##')
            if (parts.length > 1 && parts[1].trim()) {
              quantityValues.push(parts[1].trim())
            }
          }
        })
      }
    })

    if (quantityValues.length === 0) {
      toast.error('选中的记录中没有箱数数据')
      return
    }

    // 用换行符连接所有箱数
    const textToCopy = quantityValues.join('\n')

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${quantityValues.length} 个箱数到剪贴板`)
      })
      .catch((error) => {
        console.error('复制失败:', error)
        toast.error('复制失败，请重试')
      })
  }, [selectedRows])

  // 复制预约时间功能
  const handleCopyAppointmentTimes = React.useCallback((format: 'line' | 'comma' | 'space') => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有预约时间（按选中行的顺序，保持每个行内预约的顺序，不去重）
    const appointmentTimes: string[] = []
    
    selectedRows.forEach((row: any) => {
      const appointments = row.appointments || []
      appointments.forEach((appt: any) => {
        // 优先使用 confirmed_start，如果没有则使用 requested_start
        const time = appt.confirmed_start || appt.requested_start
        if (time) {
          // 格式化日期为 YYYY-MM-DD 格式
          let formattedTime: string
          try {
            const date = new Date(time)
            if (!isNaN(date.getTime())) {
              const year = date.getUTCFullYear()
              const month = String(date.getUTCMonth() + 1).padStart(2, '0')
              const day = String(date.getUTCDate()).padStart(2, '0')
              formattedTime = `${year}-${month}-${day}`
            } else {
              formattedTime = String(time)
            }
          } catch {
            // 如果解析失败，直接使用原始值
            formattedTime = String(time)
          }
          
          appointmentTimes.push(formattedTime)
        }
      })
    })

    if (appointmentTimes.length === 0) {
      toast.error('选中的记录中没有预约时间')
      return
    }

    // 根据格式拼接
    let textToCopy = ''
    switch (format) {
      case 'line':
        textToCopy = appointmentTimes.join('\n')
        break
      case 'comma':
        textToCopy = appointmentTimes.join(', ')
        break
      case 'space':
        textToCopy = appointmentTimes.join(' ')
        break
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(`已复制 ${appointmentTimes.length} 个预约时间到剪贴板`)
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
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          disabled={selectedRows.length === 0}
          onClick={() => setAddToExistingAppointmentOpen(true)}
        >
          <CalendarCheck className="mr-2 h-4 w-4" />
          加入预约
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

        {/* 复制预约号码下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[120px] h-9"
              disabled={selectedRows.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制预约号码
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>选择复制格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleCopyAppointmentNumbers('line')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">换行分隔</span>
                <span className="text-xs text-muted-foreground">每个号码一行</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyAppointmentNumbers('comma')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">逗号分隔</span>
                <span className="text-xs text-muted-foreground">A, B, C</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyAppointmentNumbers('space')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">空格分隔</span>
                <span className="text-xs text-muted-foreground">A B C</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 复制预约时间下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[120px] h-9"
              disabled={selectedRows.length === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制预约时间
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>选择复制格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleCopyAppointmentTimes('line')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">换行分隔</span>
                <span className="text-xs text-muted-foreground">每个时间一行</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyAppointmentTimes('comma')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">逗号分隔</span>
                <span className="text-xs text-muted-foreground">2024-01-01, 2024-01-02</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyAppointmentTimes('space')}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">空格分隔</span>
                <span className="text-xs text-muted-foreground">2024-01-01 2024-01-02</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 批量复制PO按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          disabled={selectedRows.length === 0}
          onClick={handleCopyPO}
        >
          <Copy className="mr-2 h-4 w-4" />
          批量复制PO
        </Button>

        {/* 批量复制FBA按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          disabled={selectedRows.length === 0}
          onClick={handleCopyFBA}
        >
          <Copy className="mr-2 h-4 w-4" />
          批量复制FBA
        </Button>

        {/* 批量复制箱数按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          disabled={selectedRows.length === 0}
          onClick={handleCopyQuantity}
        >
          <Copy className="mr-2 h-4 w-4" />
          批量复制箱数
        </Button>
      </>
    )
  }, [
    selectedRows,
    handleCopyContainerNumbers,
    handleCopyUnbookedPallets,
    handleCopyAppointmentNumbers,
    handleCopyAppointmentTimes,
    totalUnbookedPallets,
    handleNewAppointment,
    setAddToExistingAppointmentOpen,
    handleCopyPO,
    handleCopyFBA,
    handleCopyQuantity,
  ])

  return (
    <>
    <EntityTable
      config={orderDetailListConfig}
      initialFilterValues={{ inbound_receipt_status_scope: 'received' }}
      refreshKey={tableRefreshKey}
      customCellRenderers={customCellRenderers}
      customClickableColumns={customClickableColumns}
      customActions={customActions}
      customBatchActions={customBatchActions}
      pageDraftSave={{
        count: Object.keys(palletDrafts).length,
        saving: savingPallets,
        onSave: savePalletDraftsToServer,
      }}
      paginationChangeGuard={paginationChangeGuard}
      customToolbarButtons={
        <>
          <IncludeArchivedOrdersToggle
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
            id="order-details-include-archived"
          />
        </>
      }
      extraListParams={extraListParams}
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
                    <TableHead>校验装车单</TableHead>
                    <TableHead>可做单</TableHead>
                    <TableHead>已做单</TableHead>
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
                        <TableCell>{appt.verify_loading_sheet === true ? '是' : '否'}</TableCell>
                        <TableCell>{appt.can_create_sheet === true ? '是' : '否'}</TableCell>
                        <TableCell>{appt.has_created_sheet === true ? '是' : '否'}</TableCell>
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
    <Dialog
      open={navGuardOpen}
      onOpenChange={(open) => {
        if (!open) {
          const r = navResolveRef.current
          navResolveRef.current = null
          setNavGuardOpen(false)
          if (r) r(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>有未保存的修改</DialogTitle>
          <DialogDescription>
            当前页有未保存的剩余板数/未约板数草稿（保存后将标记为已校验并冻结库内数值）。请选择操作。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => finishNavGuard(false)}>
            留在本页
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPalletDrafts({})
              finishNavGuard(true)
            }}
          >
            放弃修改并继续
          </Button>
          <Button
            type="button"
            disabled={savingPallets}
            onClick={async () => {
              const ok = await savePalletDraftsToServer()
              if (ok) finishNavGuard(true)
            }}
          >
            保存并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <NewAppointmentDialog
      open={newAppointmentOpen}
      onOpenChange={setNewAppointmentOpen}
      selectedRows={selectedRows}
    />
    <AddToExistingAppointmentDialog
      open={addToExistingAppointmentOpen}
      onOpenChange={setAddToExistingAppointmentOpen}
      selectedRows={selectedRows}
      onSuccess={() => setAddToExistingAppointmentOpen(false)}
    />
    </>
  );
}

