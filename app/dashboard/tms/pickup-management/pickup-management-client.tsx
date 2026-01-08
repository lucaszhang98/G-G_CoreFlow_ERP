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
import { RefreshCw, Copy, FileText } from "lucide-react"
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

export function PickupManagementClient() {
  const [isInitializing, setIsInitializing] = React.useState(false)
  const [hasInitialized, setHasInitialized] = React.useState(false)
  const [showInitButton, setShowInitButton] = React.useState(false)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])
  const [summaryDialogOpen, setSummaryDialogOpen] = React.useState(false)
  // 用于追踪勾选顺序的状态
  const [orderedSelectedRows, setOrderedSelectedRows] = React.useState<any[]>([])
  const selectedIdsRef = React.useRef<Set<string>>(new Set())

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

  // 初始化提柜管理记录
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

  // 加载司机选项（用于司机字段的模糊搜索）
  const loadDriverOptions = React.useCallback(async (search: string = ''): Promise<FuzzySearchOption[]> => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        sort: 'driver_code',
        order: 'asc',
      })
      if (search && search.trim()) {
        params.append('search', search.trim())
        params.append('unlimited', 'true')
      }
      
      const response = await fetch(`/api/drivers?${params.toString()}`)
      if (!response.ok) {
        throw new Error('获取司机列表失败')
      }
      const result = await response.json()
      const drivers = result.data || []
      
      return drivers.map((driver: any) => ({
        label: driver.driver_code || '',
        value: String(driver.driver_id || ''),
      }))
    } catch (error) {
      console.error('加载司机选项失败:', error)
      return []
    }
  }, [])

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

  // 自定义批量操作按钮
  const customBatchActions = React.useMemo(() => {
    return (
      <>
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
  }, [handleCopyContainerNumbers, orderedSelectedRows])

  // 如果已经初始化或正在初始化，直接显示表格
  if (hasInitialized || !showInitButton) {
    return (
      <>
        <EntityTable 
          config={pickupManagementConfig}
          fieldFuzzyLoadOptions={{
            carrier: loadCarrierOptions,
            carrier_id: loadCarrierOptions, // 也支持 carrier_id 作为 key
            driver: loadDriverOptions,
            driver_id: loadDriverOptions, // 也支持 driver_id 作为 key
          }}
          customActions={{
            onView: null, // 禁用查看详情功能
          }}
          customBatchActions={customBatchActions}
          onRowSelectionChange={setSelectedRows}
        />
        
        {/* 汇总信息对话框 */}
        <PickupSummaryDialog
          open={summaryDialogOpen}
          onOpenChange={setSummaryDialogOpen}
          selectedRecords={orderedSelectedRows}
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
