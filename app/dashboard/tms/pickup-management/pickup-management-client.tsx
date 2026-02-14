/**
 * 提柜管理客户端组件
 * 负责自动初始化提柜管理记录（仅在需要时）
 */

"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { pickupManagementConfig } from "@/lib/crud/configs/pickup-management"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { RefreshCw, Copy, FileText, Mail, Download, FileSpreadsheet, Database, Upload } from "lucide-react"
import type { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PickupSummaryDialog } from "@/components/pickup-management/pickup-summary-dialog"
import { PickupImportDialog } from "./pickup-import-dialog"
import {
  generatePickupExportByTemplate,
  type PickupExportRowForTemplate,
} from "@/lib/utils/pickup-management-excel-template"

export function PickupManagementClient() {
  const [isInitializing, setIsInitializing] = React.useState(false)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [isSyncingAppointment, setIsSyncingAppointment] = React.useState(false)
  const [isSendingEmails, setIsSendingEmails] = React.useState(false)
  const [hasInitialized, setHasInitialized] = React.useState(false)
  const [showInitButton, setShowInitButton] = React.useState(false)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])
  const [summaryDialogOpen, setSummaryDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0) // 用于强制刷新表格
  const [currentSearchParams, setCurrentSearchParams] = React.useState<URLSearchParams>(new URLSearchParams())
  const [totalCount, setTotalCount] = React.useState(0)
  const [filteredCount, setFilteredCount] = React.useState(0)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  // 用于追踪勾选顺序的状态
  const [orderedSelectedRows, setOrderedSelectedRows] = React.useState<any[]>([])
  const selectedIdsRef = React.useRef<Set<string>>(new Set())

  // 初始加载时获取全部数据总数
  React.useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const response = await fetch('/api/tms/pickup-management?page=1&limit=1')
        if (response.ok) {
          const data = await response.json()
          const total = data.total ?? 0
          setTotalCount(total)
          setFilteredCount(total)
        }
      } catch (error) {
        console.error('获取提柜管理总数失败:', error)
      }
    }
    fetchTotalCount()
  }, [refreshKey])

  const handleTotalChange = React.useCallback((newTotal: number) => {
    if (totalCount === 0) setTotalCount(newTotal)
  }, [totalCount])

  const handleFilteredTotalChange = React.useCallback((newFilteredTotal: number) => {
    setFilteredCount(newFilteredTotal)
  }, [])

  // 导出选中行（与导入模板一致的双 Sheet 格式）
  const handleExportSelected = React.useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error('请先选择要导出的记录')
      return
    }
    try {
      toast.loading('正在生成Excel文件...')
      const exportData: PickupExportRowForTemplate[] = selectedRows.map((row: any) => ({
        mbl: row.mbl ?? null,
        container_number: row.container_number ?? null,
        port_location_code: row.port_location ?? null,
        carrier_name: row.carrier_name ?? row.carrier?.name ?? null,
        eta_date: row.eta_date ?? null,
        lfd_date: row.lfd_date ?? null,
        pickup_date: row.pickup_date ?? null,
        pickup_out: row.pickup_out ?? false,
        report_empty: row.report_empty ?? false,
        return_empty: row.return_empty ?? false,
        port_text: row.port_text ?? null,
        container_type: row.container_type ?? null,
        shipping_line: row.shipping_line ?? null,
        driver_name: row.driver_name ?? row.driver_code ?? null,
        current_location: row.current_location ?? null,
      }))
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `提柜管理_选中_${timestamp}`
      const workbook = await generatePickupExportByTemplate(exportData)
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success(`成功导出 ${selectedRows.length} 条提柜数据（与导入模板格式一致）`)
    } catch (error) {
      console.error('导出失败:', error)
      toast.dismiss()
      toast.error('导出失败，请重试')
    }
  }, [selectedRows])

  // 导出筛选结果（后端生成Excel）
  const handleExportFiltered = React.useCallback(async () => {
    try {
      const confirmed =
        filteredCount > 1000
          ? window.confirm(`即将导出 ${filteredCount} 条数据，可能需要数秒时间。是否继续？`)
          : true
      if (!confirmed) return
      toast.loading('正在生成Excel文件，请稍候...')
      const response = await fetch(`/api/tms/pickup-management/export?${currentSearchParams.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `导出失败 (${response.status})`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `提柜管理_筛选_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success(`成功导出 ${filteredCount} 条数据`)
    } catch (error: any) {
      console.error('导出筛选结果失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }, [currentSearchParams, filteredCount])

  // 导出全部数据（后端生成Excel）
  const handleExportAll = React.useCallback(async () => {
    try {
      const confirmed =
        totalCount > 1000
          ? window.confirm(`即将导出全部 ${totalCount} 条数据，可能需要较长时间。是否继续？`)
          : true
      if (!confirmed) return
      toast.loading('正在生成Excel文件，请稍候...')
      const response = await fetch('/api/tms/pickup-management/export?all=true')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `导出失败 (${response.status})`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `提柜管理_全部_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success(`成功导出 ${totalCount} 条数据`)
    } catch (error: any) {
      console.error('导出全部数据失败:', error)
      toast.dismiss()
      toast.error(error.message || '导出失败，请重试')
    }
  }, [totalCount])

  // 维护按勾选顺序排列的数组
  React.useEffect(() => {
    const currentSelectedIds = new Set(selectedRows.map(row => String(row.pickup_id)))
    
    // 找出新增的选中项（之前没选，现在选中了）
    const newlySelected = selectedRows.filter(row => {
      const id = String(row.pickup_id)
      return !selectedIdsRef.current.has(id)
    })
    
    // 找出被取消选中的项
    const deselectedIds = new Set<string>()
    selectedIdsRef.current.forEach(id => {
      if (!currentSelectedIds.has(id)) {
        deselectedIds.add(id)
      }
    })
    
    // 更新有序数组
    setOrderedSelectedRows(prev => {
      // 先移除被取消选中的
      let updated = prev.filter(row => !deselectedIds.has(String(row.pickup_id)))
      // 再添加新选中的
      updated = [...updated, ...newlySelected]
      return updated
    })
    
    // 更新 ref
    selectedIdsRef.current = currentSelectedIds
  }, [selectedRows])

  // 检查是否需要初始化
  React.useEffect(() => {
    const checkInitialization = async () => {
      try {
        // 检查是否有提柜管理记录
        const response = await fetch('/api/tms/pickup-management?limit=1')
        if (!response.ok) {
          throw new Error('请求失败')
        }
        const data = await response.json()
        
        // 如果没有记录，显示初始化按钮
        if (data.total === 0) {
          setShowInitButton(true)
        } else {
          setHasInitialized(true)
        }
      } catch (error) {
        console.error('检查提柜管理记录失败:', error)
        // 出错时也显示初始化按钮，让用户可以手动初始化
        setShowInitButton(true)
      }
    }

    // 延迟检查，避免与页面加载冲突
    const timer = setTimeout(() => {
      checkInitialization()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // 初始化提柜管理记录（用于首次初始化）
  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      const response = await fetch('/api/tms/pickup-management/initialize', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        toast.success(data.message || `成功为 ${data.created} 个订单创建了提柜管理记录`)
        setHasInitialized(true)
        setShowInitButton(false)
        // 刷新页面以显示新数据
        window.location.reload()
      } else {
        toast.error(data.error || '初始化失败')
      }
    } catch (error: any) {
      console.error('初始化提柜管理记录失败:', error)
      toast.error('初始化失败，请稍后重试')
    } finally {
      setIsInitializing(false)
    }
  }

  // 同步提柜管理记录（为缺失的订单创建记录）
  const handleSync = React.useCallback(async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/tms/pickup-management/initialize', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        if (data.created > 0) {
          toast.success(`成功同步 ${data.created} 条提柜管理记录`)
          // 刷新表格数据
          setRefreshKey(prev => prev + 1)
        } else {
          toast.info('所有订单都已有关联的提柜管理记录，无需同步')
        }
      } else {
        toast.error(data.error || '同步失败')
      }
    } catch (error: any) {
      console.error('同步提柜管理记录失败:', error)
      toast.error('同步失败，请稍后重试')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // 同步订单预约信息
  const handleSyncAppointmentInfo = React.useCallback(async () => {
    setIsSyncingAppointment(true)
    try {
      const response = await fetch('/api/tms/pickup-management/sync-appointment-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 空对象表示同步所有订单
      })
      const data = await response.json()

      if (data.success) {
        toast.success(data.message || `成功同步 ${data.synced_count} 个订单的预约信息`)
        // 刷新表格数据
        setRefreshKey(prev => prev + 1)
      } else {
        toast.error(data.error || '同步失败')
      }
    } catch (error: any) {
      console.error('同步订单预约信息失败:', error)
      toast.error('同步失败，请稍后重试')
    } finally {
      setIsSyncingAppointment(false)
    }
  }, [])

  // 加载司机选项（筛选：遍历司机字段去重，从 API 获取）
  const loadDriverOptions = React.useCallback(async (search: string = ''): Promise<FuzzySearchOption[]> => {
    try {
      const res = await fetch('/api/tms/pickup-management/driver-options')
      if (!res.ok) throw new Error('获取司机选项失败')
      const json = await res.json()
      const list: Array<{ value: string; label: string }> = json.data || []
      return list
        .filter((o) => !search || o.label?.toLowerCase().includes(search.toLowerCase()))
        .map((o) => ({ value: o.value, label: o.label }))
    } catch (error) {
      console.error('加载司机选项失败:', error)
      return []
    }
  }, [])

  // 加载承运公司选项（用于承运公司字段的模糊搜索）
  const loadCarrierOptions = React.useCallback(async (search: string = ''): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        sort: 'name',
        order: 'asc',
      })
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/carriers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取承运公司列表失败')
      }
      const result = await response.json()
      const carriers = result.data || []
      
      return carriers.map((carrier: any) => ({
        label: carrier.name || carrier.carrier_code || '',
        value: String(carrier.carrier_id || ''),
      }))
    } catch (error) {
      console.error('加载承运公司选项失败:', error)
      return []
    }
  }, [])

  // 批量发送邮件功能
  const handleSendEmails = React.useCallback(async () => {
    if (orderedSelectedRows.length === 0) {
      toast.error('请先选择要发送邮件的记录')
      return
    }

    setIsSendingEmails(true)
    try {
      const pickupIds = orderedSelectedRows.map((row: any) => String(row.pickup_id))
      
      const response = await fetch('/api/tms/pickup-management/send-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup_ids: pickupIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '发送邮件失败')
      }

      if (data.success) {
        if (data.failed_count === 0) {
          toast.success(`成功发送 ${data.sent_count} 封邮件`)
        } else {
          toast.warning(`成功发送 ${data.sent_count} 封邮件，${data.failed_count} 封失败`)
          if (data.errors && data.errors.length > 0) {
            console.error('发送失败的邮件:', data.errors)
          }
        }
        if (data.sent_count > 0) {
          if (data.resend_no_domain_hint) {
            toast.warning(data.resend_no_domain_hint, { duration: 8000 })
          } else {
            toast.info('若未收到请先查垃圾邮件；投递状态可在 resend.com/emails 查看')
          }
          if (data.resend_ids?.length) {
            console.log('Resend 邮件 ID（可在后台搜索）:', data.resend_ids)
          }
        }
      } else {
        toast.error(data.error || '发送邮件失败')
        if (data.details) {
          console.error('发送邮件错误详情:', data.details)
        }
      }
    } catch (error: any) {
      console.error('批量发送邮件失败:', error)
      toast.error(error.message || '发送邮件失败，请稍后重试')
    } finally {
      setIsSendingEmails(false)
    }
  }, [orderedSelectedRows])

  // 复制柜号功能
  const handleCopyContainerNumbers = React.useCallback((format: 'line' | 'comma' | 'space') => {
    if (orderedSelectedRows.length === 0) {
      toast.error('请先选择要复制的记录')
      return
    }

    // 提取所有柜号（按勾选顺序）
    const containerNumbers = orderedSelectedRows
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
  }, [orderedSelectedRows])

  // 自定义工具栏按钮：第一行两个同步按钮，第二行批量导出 + 批量导入（与订单/预约管理 UI 一致）
  const customToolbarButtons = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                同步提柜数据
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAppointmentInfo}
            disabled={isSyncingAppointment}
            className="gap-2"
          >
            {isSyncingAppointment ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                同步预约信息
              </>
            )}
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setImportDialogOpen(true)}
            className="group relative h-11 px-6 text-base font-medium border-2 border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Upload className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            <span>批量导入</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="group relative h-11 px-6 text-base font-medium border-2 border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Download className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                <span>批量导出</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[260px] p-2 bg-white border-2 border-blue-100 shadow-xl rounded-lg"
            >
              <DropdownMenuItem
                onClick={handleExportFiltered}
                className="px-4 py-3 rounded-md hover:bg-blue-50 cursor-pointer transition-colors duration-150 focus:bg-blue-50"
              >
                <FileSpreadsheet className="mr-3 h-5 w-5 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">导出筛选结果</span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    符合当前条件的 {filteredCount} 条数据
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportAll}
                className="px-4 py-3 rounded-md hover:bg-blue-50 cursor-pointer transition-colors duration-150 focus:bg-blue-50 mt-1"
              >
                <Database className="mr-3 h-5 w-5 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">导出全部数据</span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    全部 {totalCount} 条数据
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }, [
    isSyncing,
    isSyncingAppointment,
    handleSync,
    handleSyncAppointmentInfo,
    handleExportFiltered,
    handleExportAll,
    filteredCount,
    totalCount,
  ])

  // 自定义批量操作按钮
  const customBatchActions = React.useMemo(() => {
    return (
      <>
        {/* 导出选中 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          onClick={handleExportSelected}
          disabled={selectedRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          导出选中 ({selectedRows.length}条)
        </Button>
        {/* 汇总信息按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          onClick={() => {
            if (orderedSelectedRows.length === 0) {
              toast.error('请先选择要汇总的记录')
              return
            }
            setSummaryDialogOpen(true)
          }}
        >
          <FileText className="mr-2 h-4 w-4" />
          汇总信息
        </Button>

        {/* 发送邮件按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="min-w-[100px] h-9"
          onClick={handleSendEmails}
          disabled={isSendingEmails}
        >
          {isSendingEmails ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              发送中...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              发送邮件
            </>
          )}
        </Button>

        {/* 复制柜号下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[100px] h-9"
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
      </>
    )
  }, [handleCopyContainerNumbers, handleSendEmails, handleExportSelected, isSendingEmails, orderedSelectedRows, selectedRows.length])

  // 如果已经初始化或正在初始化，直接显示表格
  if (hasInitialized || !showInitButton) {
    return (
      <>
        <EntityTable 
          key={refreshKey}
          config={pickupManagementConfig}
          fieldFuzzyLoadOptions={{
            carrier: loadCarrierOptions,
            carrier_id: loadCarrierOptions,
            driver_name: loadDriverOptions,
          }}
          customActions={{
            onView: null, // 禁用查看详情功能
          }}
          customToolbarButtons={customToolbarButtons}
          customBatchActions={customBatchActions}
          onRowSelectionChange={setSelectedRows}
          onSearchParamsChange={setCurrentSearchParams}
          onTotalChange={handleTotalChange}
          onFilteredTotalChange={handleFilteredTotalChange}
        />
        
        {/* 汇总信息对话框 */}
        <PickupSummaryDialog
          open={summaryDialogOpen}
          onOpenChange={setSummaryDialogOpen}
          selectedRecords={orderedSelectedRows}
        />
        {/* 批量导入对话框 */}
        <PickupImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      </>
    )
  }

  // 如果需要初始化，显示初始化按钮
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">提柜管理未初始化</h2>
        <p className="text-muted-foreground">
          检测到订单管理中有订单，但提柜管理还没有对应的记录。
          <br />
          点击下方按钮为所有现有订单创建提柜管理记录。
        </p>
      </div>
      <Button
        onClick={handleInitialize}
        disabled={isInitializing}
        size="lg"
        className="gap-2"
      >
        {isInitializing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            正在初始化...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            初始化提柜管理记录
          </>
        )}
      </Button>
      {isInitializing && (
        <p className="text-sm text-muted-foreground">
          正在为所有订单创建提柜管理记录，请稍候...
        </p>
      )}
    </div>
  )
}
