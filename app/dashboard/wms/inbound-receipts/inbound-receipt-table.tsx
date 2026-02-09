"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { inboundReceiptConfig } from "@/lib/crud/configs/inbound-receipts"
import type { ClickableColumnConfig } from "@/lib/table/config"
import { Button } from "@/components/ui/button"
import { RefreshCw, Printer, FileText } from "lucide-react"
import { toast } from "sonner"

/** 获取当前工作周（周一至周日）的起止日期，格式 YYYY-MM-DD */
function getThisWeekDateRange(): { planned_unload_at_from: string; planned_unload_at_to: string } {
  const now = new Date()
  const day = now.getDay() // 0=周日, 1=周一, ..., 6=周六
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return {
    planned_unload_at_from: fmt(monday),
    planned_unload_at_to: fmt(sunday),
  }
}

/** 获取「最近一月及未来」的拆柜日期筛选：仅设置起始日为 30 天前，不设结束日 */
function getLastMonthAndFuture(): { planned_unload_at_from: string } {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return { planned_unload_at_from: d.toISOString().slice(0, 10) }
}

const INBOUND_ID_FIELD = 'inbound_receipt_id'

export function InboundReceiptTable() {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [selectedInboundRows, setSelectedInboundRows] = React.useState<any[]>([])

  // 生成单据：合并为一份 PDF，只开一个标签页
  const openBatchUnloadSheet = React.useCallback(() => {
    const ids = selectedInboundRows.map((r) => r[INBOUND_ID_FIELD]).filter(Boolean)
    if (ids.length === 0) {
      toast.error('请先选择要生成的记录')
      return
    }
    const idsParam = ids.join(',')
    window.open(`/api/wms/inbound-receipts/batch-print/unload-sheet?ids=${encodeURIComponent(idsParam)}`, '_blank', 'noopener,noreferrer')
    toast.success(`已打开拆柜单据打印（${ids.length} 份合并）`)
  }, [selectedInboundRows])

  // Label：选多少条开多少页。先打开启动页，用户点「打开全部」再开 N 个标签，避免被浏览器拦截
  const openBatchLabels = React.useCallback(() => {
    const ids = selectedInboundRows.map((r) => r[INBOUND_ID_FIELD]).filter(Boolean)
    if (ids.length === 0) {
      toast.error('请先选择要生成的记录')
      return
    }
    const idsParam = ids.join(',')
    window.open(
      `/dashboard/wms/inbound-receipts/batch-labels?ids=${encodeURIComponent(idsParam)}`,
      '_blank',
      'noopener,noreferrer'
    )
    toast.success(`已打开 ${ids.length} 个 Label 打印页`)
  }, [selectedInboundRows])

  const customBatchActions = React.useMemo(() => (
    <>
      <Button size="sm" variant="outline" onClick={openBatchUnloadSheet} className="min-w-[100px]">
        <Printer className="mr-2 h-4 w-4" />
        批量生成单据
      </Button>
      <Button size="sm" variant="outline" onClick={openBatchLabels} className="min-w-[100px]">
        <FileText className="mr-2 h-4 w-4" />
        批量生成 Label
      </Button>
    </>
  ), [openBatchUnloadSheet, openBatchLabels])

  // 可点击列配置：柜号列可点击跳转到入库管理详情
  const customClickableColumns: ClickableColumnConfig<any>[] = React.useMemo(() => [
    {
      columnId: "container_number",
      onClick: (row: any) => {
        // 跳转到入库管理详情页
        if (row.inbound_receipt_id) {
          router.push(`/dashboard/wms/inbound-receipts/${row.inbound_receipt_id}`)
        }
      },
      disabled: (row: any) => !row.inbound_receipt_id,
      showIcon: true,
      bold: true,
      getTitle: (row: any) =>
        row.inbound_receipt_id
          ? `点击查看入库管理详情 (ID: ${row.inbound_receipt_id})`
          : "无法查看详情：缺少入库管理ID",
    },
  ], [router])

  // 获取入库组部门ID（缓存，只获取一次）
  const departmentIdCacheRef = React.useRef<string | null | undefined>(undefined)
  const getInboundGroupDepartmentId = React.useCallback(async (): Promise<string | null> => {
    // 如果已经缓存，直接返回
    if (departmentIdCacheRef.current !== undefined) {
      return departmentIdCacheRef.current
    }
    
    try {
      // 先尝试通过名称查找
      const response = await fetch('/api/departments?search=入库组&limit=100')
      if (!response.ok) {
        departmentIdCacheRef.current = null
        return null
      }
      const result = await response.json()
      const departments = result.data || []
      const inboundGroup = departments.find((dept: any) => 
        dept.name === '入库组' || dept.code === '入库组' || dept.name?.includes('入库组')
      )
      const departmentId = inboundGroup ? String(inboundGroup.id) : null
      departmentIdCacheRef.current = departmentId
      return departmentId
    } catch (error) {
      console.error('获取入库组部门ID失败:', error)
      departmentIdCacheRef.current = null
      return null
    }
  }, [])

  // 拆柜人员选项缓存（按搜索词缓存）
  const unloadedByOptionsCacheRef = React.useRef<Map<string, Array<{ label: string; value: string }>>>(new Map())
  
  // 加载拆柜人员选项（部门为入库组且角色为入库工人的用户）
  const loadUnloadedByOptions = React.useCallback(async (search: string = '') => {
    const cacheKey = search.trim()
    
    // 检查缓存
    if (unloadedByOptionsCacheRef.current.has(cacheKey)) {
      return unloadedByOptionsCacheRef.current.get(cacheKey)!
    }
    
    try {
      // 先获取入库组部门ID
      const departmentId = await getInboundGroupDepartmentId()
      if (!departmentId) {
        console.warn('未找到入库组部门，无法加载拆柜人员')
        return []
      }

      const params = new URLSearchParams({
        limit: '1000',
        sort: 'name',
        order: 'asc',
      })
      // 添加部门和角色过滤：只获取入库组且角色为入库工人的用户
      params.append('filter_department', departmentId)
      params.append('filter_role', 'wms_inbound_worker')
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取拆柜人员列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      const options = users.map((user: any) => ({
        label: user.full_name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
      
      // 缓存结果
      unloadedByOptionsCacheRef.current.set(cacheKey, options)
      return options
    } catch (error) {
      console.error('加载拆柜人员选项失败:', error)
      return []
    }
  }, [getInboundGroupDepartmentId])

  // 入库人员选项缓存（按搜索词缓存）
  const receivedByOptionsCacheRef = React.useRef<Map<string, Array<{ label: string; value: string }>>>(new Map())

  // 加载入库人员选项（部门为入库组且角色为出库工人的用户）
  const loadReceivedByOptions = React.useCallback(async (search: string = '') => {
    const cacheKey = search.trim()
    
    // 检查缓存
    if (receivedByOptionsCacheRef.current.has(cacheKey)) {
      return receivedByOptionsCacheRef.current.get(cacheKey)!
    }
    
    try {
      // 先获取入库组部门ID
      const departmentId = await getInboundGroupDepartmentId()
      if (!departmentId) {
        console.warn('未找到入库组部门，无法加载入库人员')
        return []
      }

      const params = new URLSearchParams({
        limit: '1000',
        sort: 'name',
        order: 'asc',
      })
      // 添加部门和角色过滤：只获取入库组且角色为出库工人的用户
      params.append('filter_department', departmentId)
      params.append('filter_role', 'wms_outbound_worker')
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取入库人员列表失败')
      }
      const result = await response.json()
      const users = result.data || []
      const options = users.map((user: any) => ({
        label: user.full_name || user.username || `用户 ${user.id}`,
        value: String(user.id),
      }))
      
      // 缓存结果
      receivedByOptionsCacheRef.current.set(cacheKey, options)
      return options
    } catch (error) {
      console.error('加载入库人员选项失败:', error)
      return []
    }
  }, [getInboundGroupDepartmentId])

  // 字段模糊搜索加载函数（用于批量编辑和行内编辑中的关系字段）
  const fieldFuzzyLoadOptions = React.useMemo(() => ({
    unloaded_by: loadUnloadedByOptions,
    received_by: loadReceivedByOptions,
  }), [loadUnloadedByOptions, loadReceivedByOptions])

  const [isFixingDates, setIsFixingDates] = React.useState(false)

  // 同步缺失的入库管理记录
  const handleSyncMissingRecords = React.useCallback(async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/admin/sync-inbound-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '同步失败')
      }

      const result = await response.json()
      
      if (result.success) {
        const created = result.data?.created || 0
        if (created > 0) {
          toast.success(`成功同步 ${created} 条记录`)
          // 刷新表格
          setRefreshKey(prev => prev + 1)
        } else {
          toast.info('没有需要同步的记录')
        }
      } else {
        toast.error(result.message || '同步失败')
      }
    } catch (error: any) {
      console.error('同步失败:', error)
      toast.error(error.message || '同步失败，请重试')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // 批量修复拆柜日期（只修复空值，不覆盖已有值）
  const handleFixPlannedUnloadDates = React.useCallback(async () => {
    // 确认对话框
    const confirmed = window.confirm(
      '批量修复拆柜日期\n\n' +
      '此操作将：\n' +
      '• 只修复拆柜日期为空的记录\n' +
      '• 不会覆盖已有拆柜日期的记录\n' +
      '• 根据订单的提柜日期和到港日期自动计算\n\n' +
      '确定要继续吗？'
    )
    
    if (!confirmed) {
      return
    }

    setIsFixingDates(true)
    try {
      const response = await fetch('/api/wms/inbound-receipts/fix-planned-unload-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '修复失败')
      }

      const result = await response.json()
      
      if (result.success) {
        const fixed = result.fixed || 0
        const failed = result.failed || 0
        if (fixed > 0) {
          toast.success(`成功修复 ${fixed} 条空记录的拆柜日期${failed > 0 ? `，${failed} 条无法修复` : ''}`)
          // 刷新表格
          setRefreshKey(prev => prev + 1)
        } else {
          toast.info(result.message || '没有需要修复的记录（所有记录都有拆柜日期）')
        }
        if (result.errors && result.errors.length > 0) {
          console.warn('修复失败的记录:', result.errors)
        }
      } else {
        toast.error(result.message || '修复失败')
      }
    } catch (error: any) {
      console.error('修复失败:', error)
      toast.error(error.message || '修复失败，请重试')
    } finally {
      setIsFixingDates(false)
    }
  }, [])

  // 自定义工具栏按钮
  const customToolbarButtons = React.useMemo(() => (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncMissingRecords}
        disabled={isSyncing || isFixingDates}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? '同步中...' : '同步缺失记录'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleFixPlannedUnloadDates}
        disabled={isSyncing || isFixingDates}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isFixingDates ? 'animate-spin' : ''}`} />
        {isFixingDates ? '修复中...' : '修复拆柜日期'}
      </Button>
    </div>
  ), [handleSyncMissingRecords, handleFixPlannedUnloadDates, isSyncing, isFixingDates])

  // 快速筛选区两个按钮：显示本周 / 显示最近一月
  const customFilterContent = React.useCallback(
    (applyFilterValues: (v: Record<string, any>) => void) => (
      <>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => applyFilterValues(getThisWeekDateRange())}
        >
          显示本周数据
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => applyFilterValues(getLastMonthAndFuture())}
        >
          显示最近一月数据
        </Button>
      </>
    ),
    [],
  )

  return (
    <EntityTable 
      refreshKey={refreshKey}
      config={inboundReceiptConfig}
      customClickableColumns={customClickableColumns}
      fieldFuzzyLoadOptions={fieldFuzzyLoadOptions}
      customToolbarButtons={customToolbarButtons}
      customFilterContent={customFilterContent}
      onRowSelectionChange={setSelectedInboundRows}
      customBatchActions={customBatchActions}
    />
  )
}
