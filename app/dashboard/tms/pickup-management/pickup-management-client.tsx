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
import { RefreshCw } from "lucide-react"
import type { FuzzySearchOption } from "@/components/ui/fuzzy-search-select"

export function PickupManagementClient() {
  const [isInitializing, setIsInitializing] = React.useState(false)
  const [hasInitialized, setHasInitialized] = React.useState(false)
  const [showInitButton, setShowInitButton] = React.useState(false)

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

  // 如果已经初始化或正在初始化，直接显示表格
  if (hasInitialized || !showInitButton) {
    return (
      <EntityTable 
        config={pickupManagementConfig}
        fieldFuzzyLoadOptions={{
          carrier: loadCarrierOptions,
          carrier_id: loadCarrierOptions, // 也支持 carrier_id 作为 key
        }}
      />
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
