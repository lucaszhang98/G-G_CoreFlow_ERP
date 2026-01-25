"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Check, ChevronsUpDown, X, Search } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { LocationSelect } from "@/components/ui/location-select"
import { FuzzySearchSelect } from "@/components/ui/fuzzy-search-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface DetailData {
  id: string | number
  order_id: string | number | null
  detail_id: string | number | null
  quantity: number
  volume: number | string | null
  estimated_pallets: number | null // 预计板数（对于预约明细，这是这个预约送了多少板）
  remaining_pallets?: number | null // 剩余板数（用于显示总板数）
  delivery_nature?: string | null
  delivery_location?: string | null
  fba?: string | null
  volume_percentage?: number | string | null
  notes?: string | null
  po?: string | null // PO字段
  window_period?: string | null // 窗口期字段
  total_pallets?: number | null // 总板数（用于验证，已废弃，使用 remaining_pallets）
  total_pallets_at_time?: number | null // 总板数快照（预约明细创建/更新时的总板数）
  has_inventory?: boolean // 是否有库存
  inventory_pallets?: number | null // 库存板数
  created_at?: string | Date | null
  updated_at?: string | Date | null
  created_by?: string | number | null
  updated_by?: string | number | null
  order_detail_item_order_detail_item_detail_idToorder_detail?: Array<{
    id: string | number
    detail_name: string
    sku?: string
    description?: string | null
    stock_quantity?: number | null
    volume?: number | string | null
    status?: string | null
    fba?: string | null
  }>
  // 预约明细相关字段
  appointment_id?: string | number | null
  order_detail_id?: string | number | null
  order_number?: string | null
}

export interface DetailTableConfig {
  title: string
  showExpandable?: boolean // 是否显示展开SKU功能
  showColumns?: {
    orderNumber?: boolean // 柜号
    location?: boolean // 仓点
    locationType?: boolean // 仓点类型（性质）
    deliveryLocation?: boolean // 送仓地点
    totalVolume?: boolean // 总方数
    totalPallets?: boolean // 总板数
    estimatedPallets?: boolean // 预计板数
    volumePercentage?: boolean // 分仓占比
    unloadType?: boolean // FBA
    notes?: boolean // 备注
        po?: boolean // PO
        windowPeriod?: boolean // 窗口期
        detailId?: boolean // 仓点ID（隐藏）
    quantity?: boolean // 数量
    volume?: boolean // 体积
    createdAt?: boolean // 创建时间（隐藏）
    updatedAt?: boolean // 更新时间（隐藏）
  }
  getLocationName?: (detail: DetailData, context?: any) => string
  getOrderNumber?: (detail: DetailData, context?: any) => string
}

interface DetailTableProps {
  appointmentId?: string | number // 可选，用于预约明细（从 appointment_detail_lines 获取）
  orderId?: string | number // 可选，用于新建时或订单明细
  orderDetails?: DetailData[] // 可选，用于直接传入数据
  onRefresh: () => void
  config: DetailTableConfig
  context?: any // 上下文数据，如 orderNumber, deliveryLocation 等
}

export function DetailTable({
  appointmentId,
  orderId,
  orderDetails: initialOrderDetails,
  onRefresh,
  config,
  context = {},
}: DetailTableProps) {
  const [orderDetails, setOrderDetails] = React.useState<DetailData[]>(initialOrderDetails || [])
  const [isLoading, setIsLoading] = React.useState(false)

  // 如果提供了 appointmentId，从 appointment_detail_lines API 获取数据
  // 否则，如果提供了 orderId，从 order_detail API 获取数据
  React.useEffect(() => {
    if (initialOrderDetails) {
      setOrderDetails(initialOrderDetails)
      return
    }

    if (appointmentId) {
      // 从 appointment_detail_lines 获取预约明细
      setIsLoading(true)
      fetch(`/api/oms/appointment-detail-lines?appointmentId=${encodeURIComponent(appointmentId)}`)
        .then(res => res.json())
        .then(data => {
          console.log('[DetailTable] 获取预约明细响应:', data)
          if (data.success && data.data) {
            // 调试日志：检查返回的数据
            data.data.forEach((detail: any) => {
              console.log(`[DetailTable] 初始加载明细 ${detail.id}: remaining_pallets=${detail.remaining_pallets}, has_inventory=${detail.has_inventory}, inventory_pallets=${detail.inventory_pallets}, order_detail_id=${detail.order_detail_id}`)
            })
            console.log('[DetailTable] 预约明细数据:', data.data)
            setOrderDetails(data.data)
          } else {
            console.warn('[DetailTable] 预约明细数据为空或失败:', data)
            setOrderDetails([])
          }
        })
        .catch(error => {
          console.error('获取预约明细失败:', error)
          setOrderDetails([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else if (orderId) {
      // 从 order_detail 获取订单明细
      setIsLoading(true)
      fetch(`/api/order-details?orderId=${encodeURIComponent(orderId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setOrderDetails(data.data)
          } else {
            setOrderDetails([])
          }
        })
        .catch(error => {
          console.error('获取order details失败:', error)
          setOrderDetails([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [appointmentId, orderId, initialOrderDetails])
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editingRowId, setEditingRowId] = React.useState<string | number | null>(null)
  const [editingData, setEditingData] = React.useState<Partial<DetailData> | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<string | number | null>(null)
  const [addDetailDialogOpen, setAddDetailDialogOpen] = React.useState(false)
  const [editSkuDialogOpen, setEditSkuDialogOpen] = React.useState(false)
  const [editingSku, setEditingSku] = React.useState<any | null>(null)
  const [addSkuDialogOpen, setAddSkuDialogOpen] = React.useState(false)
  const [addSkuDetailId, setAddSkuDetailId] = React.useState<string | number | null>(null)
  // 批量编辑模式（仅用于订单明细，不用于预约明细）
  const [isBatchEditMode, setIsBatchEditMode] = React.useState(false)
  const [batchEditValues, setBatchEditValues] = React.useState<Record<string | number, Partial<DetailData>>>({})

  // 同步外部数据（如果直接提供了 orderDetails）
  React.useEffect(() => {
    if (initialOrderDetails) {
      setOrderDetails(initialOrderDetails)
    }
  }, [initialOrderDetails])

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  // 格式化整数（用于板数相关字段）
  const formatInteger = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return Math.round(numValue).toLocaleString()
  }

  // 格式化体积（不加单位，直接显示数字）
  const formatVolume = (value: number | null | string) => {
    if (value === null || value === undefined || value === '') return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-"
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  const toggleExpand = (detailId: string | number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      const idStr = String(detailId)
      if (next.has(idStr)) {
        next.delete(idStr)
      } else {
        next.add(idStr)
      }
      return next
    })
  }

  // 初始化批量编辑值（仅用于订单明细，不用于预约明细）
  const initializeBatchEditValues = () => {
    if (appointmentId) return // 预约明细不支持批量编辑
    
    const values: Record<string | number, Partial<DetailData>> = {}
    orderDetails.forEach(detail => {
      values[detail.id] = {
        quantity: detail.quantity,
        estimated_pallets: detail.estimated_pallets,
        po: detail.po || null,
        window_period: detail.window_period || null,
        delivery_location: detail.delivery_location,
        delivery_nature: detail.delivery_nature,
        volume: detail.volume,
        fba: detail.fba,
        notes: detail.notes,
      }
    })
    setBatchEditValues(values)
  }

  // 开启批量编辑模式（仅用于订单明细）
  const handleStartBatchEdit = () => {
    if (appointmentId) return // 预约明细不支持批量编辑
    initializeBatchEditValues()
    setIsBatchEditMode(true)
    // 退出单行编辑模式
    setEditingRowId(null)
    setEditingData(null)
  }

  // 取消批量编辑
  const handleCancelBatchEdit = () => {
    setIsBatchEditMode(false)
    setBatchEditValues({})
  }

  // 批量保存（仅用于订单明细）
  const handleBatchSave = async () => {
    if (appointmentId) return // 预约明细不支持批量编辑
    
    try {
      const savePromises: Promise<void>[] = []
      
      for (const detailId of Object.keys(batchEditValues)) {
        const values = batchEditValues[detailId]
        const detail = orderDetails.find(d => String(d.id) === String(detailId))
        if (!detail) continue
        
        const savePromise = (async () => {
          const response = await fetch(`/api/order-details/${detailId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`更新明细 ${detailId} 失败: ${errorData.error || errorData.message || '未知错误'}`)
          }
        })()
        
        savePromises.push(savePromise)
      }
      
      await Promise.all(savePromises)
      
      toast.success(`成功保存 ${Object.keys(batchEditValues).length} 条记录`)
      setIsBatchEditMode(false)
      setBatchEditValues({})
      onRefresh()
    } catch (error: any) {
      console.error('批量保存失败:', error)
      toast.error(error.message || '批量保存失败')
    }
  }

  const handleEditDetail = (detail: DetailData) => {
    if (isBatchEditMode) return // 批量编辑模式下不允许单行编辑
    
    setEditingRowId(detail.id)
    // 预约明细：只允许编辑预计板数（estimated_pallets），PO 从 order_detail.po 读取，不可编辑
    // 订单明细：允许编辑其他字段
    if (appointmentId) {
      setEditingData({
        estimated_pallets: detail.estimated_pallets,
        // po 不再编辑，从 order_detail.po 读取
      })
    } else {
      setEditingData({
        quantity: detail.quantity, // 添加 quantity 字段
        estimated_pallets: detail.estimated_pallets,
        po: detail.po || null,
        delivery_location: detail.delivery_location,
        delivery_nature: detail.delivery_nature,
        volume: detail.volume,
        fba: detail.fba,
        notes: detail.notes,
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingRowId(null)
    setEditingData(null)
  }

  const handleSaveEdit = async () => {
    if (!editingRowId || !editingData) return

    try {
      // 如果是预约明细，使用 appointment_detail_lines API
      if (appointmentId) {
        let response: Response
        let responseText: string = ''
        
        try {
          response = await fetch(`/api/oms/appointment-detail-lines/${editingRowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estimated_pallets: editingData.estimated_pallets,
              // po 不再发送，从 order_detail.po 读取
            }),
          })

          // 先读取响应文本（只能读取一次）
          responseText = await response.text()
        } catch (fetchError: any) {
          console.error('[DetailTable] 网络请求失败:', fetchError)
          throw new Error(`网络请求失败: ${fetchError.message || '未知错误'}`)
        }
        
        if (!response.ok) {
          let errorData: any = {}
          try {
            errorData = responseText ? JSON.parse(responseText) : {}
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}`, rawText: responseText }
          }
          throw new Error(errorData.error || errorData.message || '保存失败')
        }

        // 响应成功，尝试解析响应数据（可选，不影响成功状态）
        if (responseText) {
          try {
            const responseData = JSON.parse(responseText)
            console.log('[DetailTable] 预约明细更新成功，响应数据:', responseData)
          } catch (e) {
            // 如果响应体不是有效的 JSON，忽略错误（更新可能仍然成功）
            console.warn('[DetailTable] 响应解析警告（响应可能为空）:', e, '响应文本:', responseText)
          }
        }
        
        // 先清除编辑状态
        setEditingRowId(null)
        setEditingData(null)
        
        // 立即重新获取数据（使用 await 确保数据刷新完成）
        setIsLoading(true)
        try {
          const refreshResponse = await fetch(`/api/oms/appointment-detail-lines?appointmentId=${encodeURIComponent(appointmentId)}`)
          if (!refreshResponse.ok) {
            throw new Error(`刷新失败: ${refreshResponse.status}`)
          }
          const refreshData = await refreshResponse.json()
          console.log('[DetailTable] 刷新预约明细响应:', refreshData)
          if (refreshData.success && refreshData.data) {
            setOrderDetails(refreshData.data)
            console.log('[DetailTable] 数据已更新，明细数量:', refreshData.data.length)
          } else {
            console.warn('[DetailTable] 刷新响应格式异常:', refreshData)
          }
        } catch (error) {
          console.error('[DetailTable] 刷新预约明细失败:', error)
          // 即使刷新失败，也继续执行（数据可能已经更新）
        } finally {
          setIsLoading(false)
        }
        
        toast.success('预约明细已更新')
        onRefresh()
        return
      }

      // 否则，使用 order-details API 更新订单明细
      const response = await fetch(`/api/order-details/${editingRowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '保存失败')
      }

      toast.success('明细已更新')
      setEditingRowId(null)
      setEditingData(null)
      onRefresh()
    } catch (error: any) {
      console.error('保存失败:', error)
      toast.error(error.message || '保存失败')
    }
  }

  const handleDeleteDetail = (detailId: string | number) => {
    setItemToDelete(detailId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    try {
      // 如果是预约明细，使用 appointment_detail_lines API
      if (appointmentId) {
        let response: Response
        let responseText: string = ''
        
        try {
          response = await fetch(`/api/oms/appointment-detail-lines/${itemToDelete}`, {
            method: 'DELETE',
          })

          // 先读取响应文本（只能读取一次）
          responseText = await response.text()
        } catch (fetchError: any) {
          console.error('[DetailTable] 网络请求失败:', fetchError)
          throw new Error(`网络请求失败: ${fetchError.message || '未知错误'}`)
        }
        
        if (!response.ok) {
          let errorData: any = {}
          try {
            errorData = responseText ? JSON.parse(responseText) : {}
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}`, rawText: responseText }
          }
          throw new Error(errorData.error || errorData.message || '删除失败')
        }

        // 响应成功，尝试解析响应数据（可选，不影响成功状态）
        if (responseText) {
          try {
            const responseData = JSON.parse(responseText)
            console.log('[DetailTable] 预约明细删除成功，响应数据:', responseData)
          } catch (e) {
            // 忽略解析错误（删除可能仍然成功）
            console.warn('[DetailTable] 响应解析警告（响应可能为空）:', e, '响应文本:', responseText)
          }
        }

        // 先清除删除状态
        setDeleteDialogOpen(false)
        setItemToDelete(null)
        
        // 立即重新获取数据（使用 await 确保数据刷新完成）
        setIsLoading(true)
        try {
          const refreshResponse = await fetch(`/api/oms/appointment-detail-lines?appointmentId=${encodeURIComponent(appointmentId)}`)
          if (!refreshResponse.ok) {
            throw new Error(`刷新失败: ${refreshResponse.status}`)
          }
          const refreshData = await refreshResponse.json()
          console.log('[DetailTable] 刷新预约明细响应:', refreshData)
          if (refreshData.success && refreshData.data) {
            setOrderDetails(refreshData.data)
            console.log('[DetailTable] 数据已更新，明细数量:', refreshData.data.length)
          } else {
            console.warn('[DetailTable] 刷新响应格式异常:', refreshData)
          }
        } catch (error) {
          console.error('[DetailTable] 刷新预约明细失败:', error)
          // 即使刷新失败，也继续执行（数据可能已经更新）
        } finally {
          setIsLoading(false)
        }
        
        toast.success('预约明细已删除')
        onRefresh()
        return
      }

      // 否则，使用 order-details API 删除订单明细
      const response = await fetch(`/api/order-details/${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '删除失败')
      }

      toast.success('明细已删除')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      onRefresh()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  const handleAddDetail = async (data: {
    quantity: number
    volume?: number | null
    estimated_pallets?: number | null
    delivery_nature?: string | null
    delivery_location?: string | null
    fba?: string | null
    volume_percentage?: number | null
    notes?: string | null
    order_detail_id?: string | number | null
    order_id?: string | number | null
    outbound_shipment_id?: string | number | null
    po?: string | null
  }) => {
    try {
      // 如果是预约明细，使用 appointment_detail_lines API
      if (appointmentId) {
        if (!data.order_detail_id) {
          throw new Error('缺少必需字段：order_detail_id，请先选择明细行')
        }
        if (data.estimated_pallets === undefined || data.estimated_pallets === null) {
          throw new Error('缺少必需字段：estimated_pallets（预计板数）')
        }

        let response: Response
        let responseText: string = ''
        
        try {
          response = await fetch('/api/oms/appointment-detail-lines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointment_id: appointmentId,
              order_detail_id: data.order_detail_id,
              estimated_pallets: data.estimated_pallets,
              // po 不再发送，从 order_detail.po 读取
            }),
          })

          // 先读取响应文本（只能读取一次）
          responseText = await response.text()
        } catch (fetchError: any) {
          console.error('[DetailTable] 网络请求失败:', fetchError)
          throw new Error(`网络请求失败: ${fetchError.message || '未知错误'}`)
        }
        
        if (!response.ok) {
          let errorData: any = {}
          try {
            errorData = responseText ? JSON.parse(responseText) : {}
          } catch (e) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}`, rawText: responseText }
          }
          throw new Error(errorData.error || errorData.message || '添加失败')
        }

        // 响应成功，尝试解析响应数据
        let responseData: any = null
        if (responseText) {
          try {
            responseData = JSON.parse(responseText)
            console.log('[DetailTable] 预约明细创建成功，响应数据:', responseData)
          } catch (e) {
            // 如果响应体不是有效的 JSON，忽略错误（创建可能仍然成功）
            console.warn('[DetailTable] 响应解析警告（响应可能为空）:', e, '响应文本:', responseText)
          }
        } else {
          console.log('[DetailTable] 响应成功，但响应体为空')
        }
        
        // 先关闭对话框
        setAddDetailDialogOpen(false)
        
        // 立即重新获取数据（使用 await 确保数据刷新完成）
        setIsLoading(true)
        try {
          const refreshResponse = await fetch(`/api/oms/appointment-detail-lines?appointmentId=${encodeURIComponent(appointmentId)}`)
          if (!refreshResponse.ok) {
            throw new Error(`刷新失败: ${refreshResponse.status}`)
          }
          const refreshData = await refreshResponse.json()
          console.log('[DetailTable] 刷新预约明细响应:', refreshData)
          if (refreshData.success && refreshData.data) {
            setOrderDetails(refreshData.data)
            console.log('[DetailTable] 数据已更新，明细数量:', refreshData.data.length)
          } else {
            console.warn('[DetailTable] 刷新响应格式异常:', refreshData)
          }
        } catch (error) {
          console.error('[DetailTable] 刷新预约明细失败:', error)
          // 即使刷新失败，也继续执行（数据可能已经更新）
        } finally {
          setIsLoading(false)
        }
        
        toast.success('预约明细已添加')
        onRefresh()
        return
      }

      // 否则，创建 order_detail（订单明细）
      if (!data.order_id) {
        throw new Error('缺少必需字段：order_id')
      }

      const response = await fetch('/api/order-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: data.order_id,
          quantity: data.quantity,
          volume: data.volume,
          delivery_nature: data.delivery_nature,
          delivery_location: data.delivery_location,
          fba: data.fba,
          notes: data.notes,
          po: data.po,
          window_period: (data as any).window_period || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '添加失败')
      }

      toast.success('明细已添加')
      setAddDetailDialogOpen(false)
      onRefresh()
    } catch (error: any) {
      console.error('添加失败:', error)
      toast.error(error.message || '添加失败')
      throw error
    }
  }

  // 获取显示的列（按照指定顺序：送仓地点-性质-数量-体积-预计板数-分仓占比-FBA-备注）
  const getVisibleColumns = () => {
    const cols: string[] = []
    if (config.showExpandable) cols.push('expand')
    if (config.showColumns?.orderNumber) cols.push('orderNumber')
    if (config.showColumns?.location) cols.push('location')
    // 按照要求的顺序添加字段
    if (config.showColumns?.deliveryLocation) cols.push('deliveryLocation') // 送仓地点
    if (config.showColumns?.locationType) cols.push('locationType') // 性质
    if (config.showColumns?.quantity) cols.push('quantity') // 数量
    if (config.showColumns?.volume) cols.push('volume') // 体积
    if (config.showColumns?.estimatedPallets) cols.push('estimatedPallets') // 预计板数
    if (config.showColumns?.volumePercentage) cols.push('volumePercentage') // 分仓占比
    if (config.showColumns?.unloadType) cols.push('unloadType') // FBA
    if (config.showColumns?.notes) cols.push('notes') // 备注
    // 其他可选字段
    if (config.showColumns?.totalVolume) cols.push('totalVolume')
    if (config.showColumns?.totalPallets) cols.push('totalPallets')
    if (config.showColumns?.po) cols.push('po')
    if (config.showColumns?.windowPeriod) cols.push('windowPeriod')
    if (config.showColumns?.detailId) cols.push('detailId')
    if (config.showColumns?.createdAt) cols.push('createdAt')
    if (config.showColumns?.updatedAt) cols.push('updatedAt')
    // 批量编辑模式下不显示操作列
    if (!isBatchEditMode) {
      cols.push('actions')
    }
    return cols
  }

  const visibleColumns = getVisibleColumns()

  if (orderDetails.length === 0) {
    return (
      <div className="p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold text-sm text-foreground">{config.title}</h4>
          {/* 添加按钮放在标题右边 */}
          <Button size="sm" onClick={() => setAddDetailDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加
          </Button>
        </div>
        <p className="text-muted-foreground text-center py-4 text-sm">暂无明细</p>
        <AddDetailDialog
          open={addDetailDialogOpen}
          onOpenChange={setAddDetailDialogOpen}
          onSave={handleAddDetail}
          showDeliveryNature={config.showColumns?.locationType}
          orderId={orderId}
          appointmentId={appointmentId}
        />
      </div>
    )
  }

  return (
    <div className="p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm text-foreground">{config.title}</h4>
          {/* 添加按钮放在标题右边 */}
          <Button size="sm" onClick={() => setAddDetailDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* 批量编辑按钮（仅订单明细显示，预约明细不显示） */}
          {!appointmentId && (
            isBatchEditMode ? (
              <>
                <Button
                  size="sm"
                  onClick={handleBatchSave}
                  className="h-8"
                >
                  <Check className="h-4 w-4 mr-1" />
                  保存全部
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelBatchEdit}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  取消
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStartBatchEdit}
                className="h-8"
                title="批量编辑"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              {visibleColumns.map((col) => {
                switch (col) {
                  case 'expand':
                    return <th key={col} className="text-left p-2 font-semibold text-sm w-12"></th>
                  case 'orderNumber':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">柜号</th>
                  case 'location':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">仓点</th>
                  case 'locationType':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">性质</th>
                  case 'deliveryLocation':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">送仓地点</th>
                  case 'totalVolume':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">总方数</th>
                  case 'totalPallets':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">总板数</th>
                  case 'estimatedPallets':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">预计板数</th>
                  case 'volumePercentage':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">分仓占比</th>
                  case 'unloadType':
                    return <th key={col} className="text-left p-2 font-semibold text-sm min-w-[200px]">FBA</th>
                  case 'notes':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">备注</th>
                  case 'po':
                    return <th key={col} className="text-left p-2 font-semibold text-sm min-w-[200px]">PO</th>
                  case 'windowPeriod':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">窗口期</th>
                  case 'detailId':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">仓点ID</th>
                  case 'quantity':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">数量</th>
                  case 'volume':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">体积</th>
                  case 'createdAt':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">创建时间</th>
                  case 'updatedAt':
                    return <th key={col} className="text-left p-2 font-semibold text-sm">更新时间</th>
                  case 'actions':
                    // 批量编辑模式下隐藏操作列
                    if (isBatchEditMode) {
                      return null
                    }
                    return <th key={col} className="text-left p-2 font-semibold text-sm w-24">操作</th>
                  default:
                    return null
                }
              })}
            </tr>
          </thead>
          <tbody>
            {orderDetails.map((detail: any, index: number) => {
              const detailId = detail.id
              const isExpanded = expandedRows.has(String(detailId))
              const skuItems = detail.order_detail_item_order_detail_item_detail_idToorder_detail || []
              // 仓点：优先使用 delivery_location_code（从 API 返回），如果没有则使用 delivery_location（API 已转换为 location_code），最后使用配置的 getLocationName 或 context
              const locationCode = (detail as any).delivery_location_code 
                || detail.delivery_location 
                || (config.getLocationName ? config.getLocationName(detail, context) : null)
                || context.deliveryLocation 
                || '-'
              // 柜号：优先使用 detail.order_number，如果没有则使用配置的 getOrderNumber 或 context
              const orderNumber = (detail as any).order_number
                || (config.getOrderNumber ? config.getOrderNumber(detail, context) : null)
                || context.orderNumber 
                || '-'

              return (
                <React.Fragment key={detailId || index}>
                  <tr className="border-b last:border-b-0 hover:bg-muted/20">
                    {visibleColumns.map((col) => {
                      switch (col) {
                        case 'expand':
                          return config.showExpandable ? (
                            <td key={col} className="p-2 text-sm">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(detailId)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                          ) : null
                        case 'orderNumber':
                          return <td key={col} className="p-2 text-sm">{orderNumber}</td>
                        case 'location':
                          // 仓点：显示 location_code（从 delivery_location 转换而来）
                          return <td key={col} className="p-2 text-sm">{locationCode}</td>
                        case 'deliveryLocation':
                          // 订单明细可以编辑送仓地点，预约明细不允许编辑，直接显示 location_code（API 已转换）
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode 
                              ? (batchEditValues[detailId]?.delivery_location || detail.delivery_location)
                              : (editingData?.delivery_location || detail.delivery_location)
                            return (
                              <td key={col} className="p-2 text-sm">
                                <LocationSelect
                                  value={currentValue || null}
                                  onChange={(value: string | number | null) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          delivery_location: value ? String(value) : null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, delivery_location: value ? String(value) : null })
                                    }
                                  }}
                                  placeholder="选择送仓地点"
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm">{(detail as any).delivery_location_code || detail.delivery_location || '-'}</td>
                        case 'locationType':
                          // 订单明细可以编辑仓点类型，预约明细不允许编辑，显示时如果是"亚马逊"改为"AMZ"
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode
                              ? (batchEditValues[detailId]?.delivery_nature || detail.delivery_nature)
                              : (editingData?.delivery_nature || detail.delivery_nature)
                            return (
                              <td key={col} className="p-2 text-sm">
                                <Select
                                  value={currentValue || ''}
                                  onValueChange={(value) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          delivery_nature: value || null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, delivery_nature: value || null })
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 min-w-[120px]">
                                    <SelectValue placeholder="请选择" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AMZ">AMZ</SelectItem>
                                    <SelectItem value="扣货">扣货</SelectItem>
                                    <SelectItem value="已放行">已放行</SelectItem>
                                    <SelectItem value="私仓">私仓</SelectItem>
                                    <SelectItem value="转仓">转仓</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm">{detail.delivery_nature === '亚马逊' ? 'AMZ' : (detail.delivery_nature || '-')}</td>
                      case 'quantity':
                        // 订单明细可以编辑数量，预约明细不允许编辑
                        if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                          const currentValue = isBatchEditMode
                            ? (batchEditValues[detailId]?.quantity ?? detail.quantity)
                            : (editingData?.quantity ?? detail.quantity)
                          return (
                            <td key={col} className="p-2 text-sm">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={currentValue ?? ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value
                                  if (inputValue === '') {
                                    const newValue = 1
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          quantity: newValue,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, quantity: newValue })
                                    }
                                  } else {
                                    const value = parseInt(inputValue)
                                    // 只允许正整数
                                    if (!isNaN(value) && value > 0 && Number.isInteger(value)) {
                                      if (isBatchEditMode) {
                                        setBatchEditValues(prev => ({
                                          ...prev,
                                          [detailId]: {
                                            ...prev[detailId],
                                            quantity: value,
                                          }
                                        }))
                                      } else {
                                        setEditingData({ ...editingData, quantity: value })
                                      }
                                    }
                                  }
                                }}
                                className="w-full min-w-[80px] max-w-[100px] h-9"
                                placeholder="数量"
                              />
                            </td>
                          )
                        }
                        return <td key={col} className="p-2 text-sm">{formatNumber(detail.quantity)}</td>
                      case 'volume':
                        // 订单明细可以编辑体积，预约明细不允许编辑
                        if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                          const currentValue = isBatchEditMode
                            ? (batchEditValues[detailId]?.volume ?? detail.volume)
                            : (editingData?.volume ?? detail.volume)
                          return (
                            <td key={col} className="p-2 text-sm">
                              <Input
                                type="number"
                                step="0.01"
                                value={currentValue !== null && currentValue !== undefined ? currentValue : ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                  if (isBatchEditMode) {
                                    setBatchEditValues(prev => ({
                                      ...prev,
                                      [detailId]: {
                                        ...prev[detailId],
                                        volume: value,
                                      }
                                    }))
                                  } else {
                                    setEditingData({ ...editingData, volume: value })
                                  }
                                }}
                                className="w-full min-w-[100px] max-w-[120px] h-9"
                                placeholder="体积"
                              />
                            </td>
                          )
                        }
                          return <td key={col} className="p-2 text-sm">{formatVolume(detail.volume)}</td>
                        case 'estimatedPallets':
                          // 预计板数：显示这个预约送了多少板（可编辑）
                          if (editingRowId === detailId && editingData && appointmentId) {
                            // 获取最大板数（剩余板数）
                            const maxPallets = detail.remaining_pallets ?? detail.estimated_pallets ?? 0
                            return (
                              <td key={col} className="p-2 text-sm">
                                <Input
                                  type="number"
                                  value={editingData.estimated_pallets !== null && editingData.estimated_pallets !== undefined ? editingData.estimated_pallets : ''}
                                  onChange={(e) => {
                                    const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                    setEditingData({ ...editingData, estimated_pallets: value })
                                  }}
                                  className="w-full"
                                  min="0"
                                  max={maxPallets}
                                  placeholder={`0-${maxPallets}`}
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm">{formatInteger(detail.estimated_pallets)}</td>
                        case 'volumePercentage':
                          return <td key={col} className="p-2 text-sm">{detail.volume_percentage ? `${formatNumber(detail.volume_percentage)}%` : '-'}</td>
                        case 'unloadType':
                          // 订单明细可以编辑FBA，预约明细不允许编辑
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode
                              ? (batchEditValues[detailId]?.fba ?? detail.fba)
                              : (editingData?.fba ?? detail.fba)
                            // 根据内容长度计算行数（每行约50个字符）
                            const textLines = (currentValue || '').split('\n')
                            const estimatedRows = Math.max(2, Math.min(10, textLines.reduce((max: number, line: string) => {
                              return Math.max(max, Math.ceil(line.length / 50) || 1)
                            }, textLines.length)))
                            return (
                              <td key={col} className="p-2 text-sm min-w-[200px]">
                                <Textarea
                                  value={currentValue || ''}
                                  onChange={(e) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          fba: e.target.value || null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, fba: e.target.value || null })
                                    }
                                  }}
                                  className="w-full min-w-[200px] min-h-[60px] resize-both"
                                  placeholder="FBA"
                                  rows={estimatedRows}
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm whitespace-pre-wrap break-words">{detail.fba || '-'}</td>
                        case 'notes':
                          // 订单明细可以编辑备注，预约明细不允许编辑
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode
                              ? (batchEditValues[detailId]?.notes ?? detail.notes)
                              : (editingData?.notes ?? detail.notes)
                            return (
                              <td key={col} className="p-2 text-sm">
                                <Input
                                  type="text"
                                  value={currentValue || ''}
                                  onChange={(e) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          notes: e.target.value || null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, notes: e.target.value || null })
                                    }
                                  }}
                                  className="w-full"
                                  placeholder="备注"
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm">{detail.notes || '-'}</td>
                        case 'totalVolume':
                          return <td key={col} className="p-2 text-sm">{formatVolume(detail.volume)}</td>
                        case 'totalPallets':
                          // 总板数：优先使用实时的 remaining_pallets（已入库用 unbooked_pallet_count，未入库用 remaining_pallets），否则使用快照或预计板数，显示整数
                          // 注意：detail.remaining_pallets 已经是 API 返回的实时值（已入库时是 unbooked_pallet_count，未入库时是 order_detail.remaining_pallets）
                          const totalPallets = detail.remaining_pallets ?? (detail as any).total_pallets_at_time ?? detail.estimated_pallets
                          // 调试日志（仅在开发环境）
                          if (process.env.NODE_ENV === 'development' && detail.has_inventory) {
                            console.log(`[DetailTable] 显示总板数 detail.id=${detail.id}, order_detail_id=${detail.order_detail_id}: remaining_pallets=${detail.remaining_pallets}, has_inventory=${detail.has_inventory}, inventory_pallets=${detail.inventory_pallets}, totalPallets=${totalPallets}`)
                          }
                          return <td key={col} className="p-2 text-sm">{formatInteger(totalPallets)}</td>
                        case 'po':
                          // 订单明细可以编辑PO，预约明细中PO从order_detail.po读取，不可编辑
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode
                              ? (batchEditValues[detailId]?.po ?? (detail as any).po)
                              : (editingData?.po ?? (detail as any).po)
                            // 根据内容长度计算行数（每行约50个字符）
                            const textLines = (currentValue || '').split('\n')
                            const estimatedRows = Math.max(2, Math.min(10, textLines.reduce((max: number, line: string) => {
                              return Math.max(max, Math.ceil(line.length / 50) || 1)
                            }, textLines.length)))
                            return (
                              <td key={col} className="p-2 text-sm min-w-[200px]">
                                <Textarea
                                  value={currentValue || ''}
                                  onChange={(e) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          po: e.target.value || null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, po: e.target.value || null })
                                    }
                                  }}
                                  className="w-full min-w-[200px] min-h-[60px] resize-both"
                                  placeholder="PO"
                                  rows={estimatedRows}
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm whitespace-pre-wrap break-words">{(detail as any).po || '-'}</td>
                        case 'windowPeriod':
                          // 订单明细可以编辑窗口期，预约明细不允许编辑
                          if ((isBatchEditMode || editingRowId === detailId) && !appointmentId) {
                            const currentValue = isBatchEditMode
                              ? (batchEditValues[detailId]?.window_period ?? detail.window_period)
                              : (editingData?.window_period ?? detail.window_period)
                            return (
                              <td key={col} className="p-2 text-sm">
                                <Input
                                  type="text"
                                  value={currentValue || ''}
                                  onChange={(e) => {
                                    if (isBatchEditMode) {
                                      setBatchEditValues(prev => ({
                                        ...prev,
                                        [detailId]: {
                                          ...prev[detailId],
                                          window_period: e.target.value || null,
                                        }
                                      }))
                                    } else {
                                      setEditingData({ ...editingData, window_period: e.target.value || null })
                                    }
                                  }}
                                  className="w-full"
                                  placeholder="窗口期"
                                />
                              </td>
                            )
                          }
                          return <td key={col} className="p-2 text-sm">{detail.window_period || '-'}</td>
                        case 'detailId':
                          return <td key={col} className="p-2 text-sm font-medium">{detailId}</td>
                        case 'createdAt':
                          return <td key={col} className="p-2 text-sm">{formatDate(detail.created_at)}</td>
                        case 'updatedAt':
                          return <td key={col} className="p-2 text-sm">{formatDate(detail.updated_at)}</td>
                        case 'actions':
                          // 批量编辑模式下隐藏操作列
                          if (isBatchEditMode) {
                            return null
                          }
                          if (editingRowId === detailId) {
                            return (
                              <td key={col} className="p-2 text-sm">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSaveEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            )
                          }
                          return (
                            <td key={col} className="p-2 text-sm">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditDetail(detail)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteDetail(detailId)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          )
                        default:
                          return null
                      }
                    })}
                  </tr>

                  {/* 展开行：SKU明细 */}
                  {config.showExpandable && isExpanded && (
                    <tr className="bg-muted/50">
                      <td colSpan={visibleColumns.length} className="p-0">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">
                              SKU明细 ({skuItems.length})
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAddSkuDetailId(detailId)
                                setAddSkuDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              添加SKU
                            </Button>
                          </div>
                          {skuItems.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-muted/50 border-b">
                                    <th className="text-left p-2 font-semibold text-sm">SKU</th>
                                    <th className="text-left p-2 font-semibold text-sm">明细名称</th>
                                    <th className="text-left p-2 font-semibold text-sm">描述</th>
                                    <th className="text-left p-2 font-semibold text-sm">库存数量</th>
                                    <th className="text-left p-2 font-semibold text-sm">体积</th>
                                    <th className="text-left p-2 font-semibold text-sm">状态</th>
                                    <th className="text-left p-2 font-semibold text-sm">FBA</th>
                                    <th className="text-left p-2 font-semibold text-sm w-24">操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {skuItems.map((item: any) => (
                                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
                                      <td className="p-2 text-sm font-medium">{item.sku}</td>
                                      <td className="p-2 text-sm">{item.detail_name}</td>
                                      <td className="p-2 text-sm">{item.description || "-"}</td>
                                      <td className="p-2 text-sm">{formatNumber(item.stock_quantity)}</td>
                                      <td className="p-2 text-sm">{formatVolume(item.volume)}</td>
                                      <td className="p-2 text-sm">
                                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                          {item.status || '-'}
                                        </Badge>
                                      </td>
                                      <td className="p-2 text-sm">{item.fba || "-"}</td>
                                      <td className="p-2 text-sm">
                                        <div className="flex gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setEditingSku(item)
                                              setEditSkuDialogOpen(true)
                                            }}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                              try {
                                                const response = await fetch(`/api/order-detail-items/${item.id}`, {
                                                  method: 'DELETE',
                                                })
                                                if (!response.ok) {
                                                  const errorData = await response.json()
                                                  throw new Error(errorData.error || errorData.message || '删除失败')
                                                }
                                                toast.success('SKU明细已删除')
                                                onRefresh()
                                              } catch (error: any) {
                                                toast.error(error.message || '删除失败')
                                              }
                                            }}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-center py-4 text-sm">
                              暂无SKU明细，点击"添加SKU"按钮添加
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 添加明细弹窗 */}
      <AddDetailDialog
        open={addDetailDialogOpen}
        onOpenChange={setAddDetailDialogOpen}
        onSave={handleAddDetail}
        showDeliveryNature={config.showColumns?.locationType}
        orderId={orderId}
        appointmentId={appointmentId}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个明细吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SKU相关弹窗（如果启用展开功能） */}
      {config.showExpandable && (
        <>
          <EditSkuDialog
            open={editSkuDialogOpen}
            onOpenChange={setEditSkuDialogOpen}
            sku={editingSku}
            onSave={async (data) => {
              if (!editingSku) return
              try {
                const response = await fetch(`/api/order-detail-items/${editingSku.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
                })
                if (!response.ok) {
                  const errorData = await response.json()
                  throw new Error(errorData.error || errorData.message || '保存失败')
                }
                toast.success('SKU明细已更新')
                setEditSkuDialogOpen(false)
                setEditingSku(null)
                onRefresh()
              } catch (error: any) {
                toast.error(error.message || '保存失败')
                throw error
              }
            }}
          />
          <AddSkuDialog
            open={addSkuDialogOpen}
            onOpenChange={setAddSkuDialogOpen}
            detailId={addSkuDetailId}
            onSave={async (data) => {
              if (!addSkuDetailId) return
              try {
                const response = await fetch('/api/order-detail-items', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    detail_id: addSkuDetailId,
                    ...data,
                  }),
                })
                if (!response.ok) {
                  const errorData = await response.json()
                  throw new Error(errorData.error || errorData.message || '添加失败')
                }
                toast.success('SKU明细已添加')
                setAddSkuDialogOpen(false)
                setAddSkuDetailId(null)
                onRefresh()
              } catch (error: any) {
                toast.error(error.message || '添加失败')
                throw error
              }
            }}
          />
        </>
      )}
    </div>
  )
}

// 编辑明细弹窗组件
function EditDetailDialog({
  open,
  onOpenChange,
  detail,
  onSave,
  showDeliveryNature,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: DetailData | null
  onSave: (data: {
    estimated_pallets?: number | null
    po?: string | null
  }) => Promise<void>
  showDeliveryNature?: boolean
}) {
  const [estimatedPallets, setEstimatedPallets] = React.useState<string>('')
  const [po, setPo] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [totalPallets, setTotalPallets] = React.useState<number>(0)
  const [isLoadingTotalPallets, setIsLoadingTotalPallets] = React.useState(false)

  // 获取总板数：直接使用 detail.remaining_pallets（API 返回的实时值）
  React.useEffect(() => {
    if (detail) {
      // 优先使用实时的 remaining_pallets（已入库用 unbooked_pallet_count，未入库用 remaining_pallets），否则使用快照或预计板数
      const total = detail.remaining_pallets ?? (detail as any).total_pallets_at_time ?? (detail.has_inventory 
        ? (detail.inventory_pallets || 0)
        : (detail.estimated_pallets || 0))
      setTotalPallets(total)
      console.log(`[AddDetailDialog] 设置总板数: detail.id=${detail.id}, remaining_pallets=${detail.remaining_pallets}, has_inventory=${detail.has_inventory}, total=${total}`)
    } else {
      setTotalPallets(0)
    }
  }, [detail])

  React.useEffect(() => {
    if (detail) {
      setEstimatedPallets(detail.estimated_pallets?.toString() || '')
    }
  }, [detail])

  React.useEffect(() => {
    if (!open) {
      setEstimatedPallets('')
      setIsSaving(false)
      setTotalPallets(0)
    }
  }, [open])

  const handleSubmit = async () => {
    // 验证预计板数
    const estimatedPalletsValue = estimatedPallets ? parseInt(estimatedPallets) : null
    if (!estimatedPalletsValue || estimatedPalletsValue <= 0) {
      toast.error('预计板数必须大于0')
      return
    }
    if (totalPallets > 0 && estimatedPalletsValue > totalPallets) {
      toast.error(`预计板数不能大于总板数（${totalPallets}）`)
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        estimated_pallets: estimatedPalletsValue,
        // PO不能编辑，不传递
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  if (!detail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑明细</DialogTitle>
          <DialogDescription>
            修改明细的预计板数和PO。明细ID: {detail.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="estimated_pallets">
              预计板数 *
              {totalPallets > 0 && (
                <span className="text-muted-foreground text-xs ml-2">
                  (范围: 1 - {totalPallets})
                </span>
              )}
            </Label>
            <Input
              id="estimated_pallets"
              type="number"
              value={estimatedPallets}
              onChange={(e) => setEstimatedPallets(e.target.value)}
              placeholder="请输入预计板数"
              min="1"
              max={totalPallets > 0 ? totalPallets : undefined}
            />
          </div>
          {/* PO不能编辑，从order_detail读取 */}
          {detail && (
            <div className="space-y-2">
              <Label htmlFor="po">PO</Label>
              <Input
                id="po"
                value={(detail as any).po || '-'}
                disabled
                className="bg-muted"
                placeholder="PO从订单明细读取，不可编辑"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 添加明细弹窗组件
function AddDetailDialog({
  open,
  onOpenChange,
  onSave,
  showDeliveryNature,
  orderId,
  appointmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    quantity: number
    volume?: number | null
    estimated_pallets?: number | null
    delivery_nature?: string | null
    delivery_location?: string | null
    fba?: string | null
    volume_percentage?: number | null
    notes?: string | null
    order_detail_id?: string | number | null
    order_id?: string | number | null
    outbound_shipment_id?: string | number | null
    po?: string | null
  }) => Promise<void>
  showDeliveryNature?: boolean
  orderId?: string | number
  appointmentId?: string | number
}) {
  // 步骤状态：1-选择柜号，2-选择明细行，3-填写预计板数
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  
  // 第一步：选择柜号
  const [orderSearchOpen, setOrderSearchOpen] = React.useState(false)
  const [orderSearch, setOrderSearch] = React.useState('')
  const [orders, setOrders] = React.useState<Array<{ order_id: string; order_number: string }>>([])
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null)
  const [selectedOrderNumber, setSelectedOrderNumber] = React.useState<string>('')
  
  // 第二步：选择明细行
  const [orderDetails, setOrderDetails] = React.useState<Array<{
    id: string
    quantity: number
    volume: number | null
    estimated_pallets: number | null
    delivery_nature: string | null
    location_code: string | null // 仓点编码（从 delivery_location 获取）
    has_inventory: boolean
    inventory_pallets: number | null
    remaining_pallets?: number | null // 总板数（已入库用 unbooked_pallet_count，未入库用 remaining_pallets）
    total_pallets_at_time?: number | null // 总板数快照
    matches_appointment_destination?: boolean // 送仓地点是否与预约目的地一致
    appointment_destination_location_code?: string | null // 预约目的地编码
    notes?: string | null // 备注字段
    po?: string | null // PO字段
  }>>([])
  const [selectedDetailId, setSelectedDetailId] = React.useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = React.useState<any>(null)
  const [appointmentDestination, setAppointmentDestination] = React.useState<{
    location_id: string
    location_code: string | null
  } | null>(null)
  const [showDestinationMismatchDialog, setShowDestinationMismatchDialog] = React.useState(false)
  const [pendingDetailSelection, setPendingDetailSelection] = React.useState<any>(null)
  
  // 第三步：填写预计板数和PO
  const [estimatedPallets, setEstimatedPallets] = React.useState<string>('')
  const [po, setPo] = React.useState<string>('')
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false)
  const [isLoadingShipment, setIsLoadingShipment] = React.useState(false)

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  // 格式化整数（用于板数相关字段）
  const formatInteger = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return Math.round(numValue).toLocaleString()
  }

  // 格式化体积（不加单位，直接显示数字）
  const formatVolume = (value: number | null | string) => {
    if (value === null || value === undefined || value === '') return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // 搜索订单的逻辑已移到 FuzzySearchSelect 的 loadOptions 中

  // outbound_shipment_lines 已被删除，不再需要获取 outbound_shipment_id

  // 选择订单后，加载订单明细
  React.useEffect(() => {
    if (selectedOrderId) {
      setIsLoadingDetails(true)
      // 如果提供了 appointmentId，在请求中传递
      const url = appointmentId 
        ? `/api/oms/appointments/order-details/${selectedOrderId}?appointmentId=${encodeURIComponent(appointmentId)}`
        : `/api/oms/appointments/order-details/${selectedOrderId}`
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.details) {
            setOrderDetails(data.data.details)
            // 保存预约目的地信息（如果提供了）
            if (data.data.appointment_destination) {
              setAppointmentDestination(data.data.appointment_destination)
            }
          }
        })
        .catch(error => {
          console.error('获取订单明细失败:', error)
          toast.error('获取订单明细失败')
        })
        .finally(() => {
          setIsLoadingDetails(false)
        })
    }
  }, [selectedOrderId, appointmentId])

  // 重置状态
  React.useEffect(() => {
    if (!open) {
      setStep(1)
      setOrders([])
      setSelectedOrderId(null)
      setSelectedOrderNumber('')
      setOrderDetails([])
      setSelectedDetailId(null)
      setSelectedDetail(null)
      setEstimatedPallets('')
      setPo('')
      setIsSaving(false)
      setAppointmentDestination(null)
      setShowDestinationMismatchDialog(false)
      setPendingDetailSelection(null)
    }
  }, [open])

  // 选择订单
  const handleSelectOrder = (orderId: string, orderNumber: string) => {
    setSelectedOrderId(orderId)
    setSelectedOrderNumber(orderNumber)
    setStep(2)
  }

  // 选择明细行
  const handleSelectDetail = (detail: any) => {
    // 如果是预约明细，检查送仓地点是否与预约目的地一致
    if (appointmentId && appointmentDestination) {
      const matchesDestination = detail.matches_appointment_destination === true
      if (!matchesDestination) {
        // 送仓地点与预约目的地不一致，显示警告对话框
        setPendingDetailSelection(detail)
        setShowDestinationMismatchDialog(true)
        return
      }
    }
    
    // 送仓地点一致或不是预约明细，直接选择
    confirmDetailSelection(detail)
  }
  
  // 确认选择明细行
  const confirmDetailSelection = (detail: any) => {
    setSelectedDetailId(detail.id)
    setSelectedDetail(detail)
    // 自动填充预计板数，默认值为实时的 remaining_pallets（已入库用 unbooked_pallet_count，未入库用 remaining_pallets），否则使用快照或总板数
    const totalPallets = detail.remaining_pallets ?? (detail as any).total_pallets_at_time ?? (detail.has_inventory 
      ? (detail.inventory_pallets || 0)
      : (detail.estimated_pallets || 0))
    setEstimatedPallets(totalPallets.toString())
    // 如果是预约明细，PO可以编辑；否则从order_detail读取
    if (appointmentId) {
      setPo(detail.po || '')
    }
    setStep(3)
  }

  // 提交
  const handleSubmit = async () => {
    if (!selectedDetail) {
      toast.error('请选择明细行')
      return
    }

    // 计算总板数（优先使用实时的 remaining_pallets，否则使用快照或总板数）
    const totalPallets = selectedDetail.remaining_pallets ?? (selectedDetail as any).total_pallets_at_time ?? (selectedDetail.has_inventory 
      ? (selectedDetail.inventory_pallets || 0)
      : (selectedDetail.estimated_pallets || 0))

    // 验证预计板数
    const estimatedPalletsValue = estimatedPallets ? parseInt(estimatedPallets) : null
    if (!estimatedPalletsValue || estimatedPalletsValue <= 0) {
      toast.error('预计板数必须大于0')
      return
    }
    if (estimatedPalletsValue > totalPallets) {
      toast.error(`预计板数不能大于剩余板数（${totalPallets}）`)
      return
    }

    // 如果是预约明细，需要 appointmentId 和 order_detail_id
    if (appointmentId) {
      if (!selectedDetailId) {
        toast.error('请选择明细行')
        return
      }
      setIsSaving(true)
      try {
        await onSave({
          quantity: selectedDetail.quantity,
          volume: selectedDetail.volume,
          estimated_pallets: estimatedPalletsValue,
          order_detail_id: selectedDetailId,
          po: po || null,
        })
      } catch (error) {
        // 错误已在onSave中处理
      } finally {
        setIsSaving(false)
      }
      return
    }

    // 否则，创建 order_detail
    if (!orderId && !selectedOrderId) {
      toast.error('缺少订单ID')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        quantity: selectedDetail.quantity,
        volume: selectedDetail.volume,
        estimated_pallets: estimatedPalletsValue,
        delivery_nature: showDeliveryNature ? (selectedDetail.delivery_nature || null) : undefined,
        order_detail_id: selectedDetail.id,
        order_id: selectedOrderId || orderId,
        po: null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  // 如果是 order_detail（有 orderId），显示简单表单
  if (orderId) {
    const [formData, setFormData] = React.useState({
      quantity: 0,
      volume: '',
      delivery_location: null as string | number | null,
      delivery_nature: '',
      fba: '',
      notes: '',
      po: '',
      window_period: '',
    })

    React.useEffect(() => {
      if (!open) {
        setFormData({
          quantity: 0,
          volume: '',
          delivery_location: null,
          delivery_nature: '',
          fba: '',
          notes: '',
          po: '',
          window_period: '',
        })
      }
    }, [open])

    const handleSubmit = async () => {
      if (!formData.volume || parseFloat(formData.volume) <= 0) {
        toast.error('体积必须大于0')
        return
      }

      setIsSaving(true)
      try {
        await onSave({
          quantity: formData.quantity,
          volume: parseFloat(formData.volume),
          delivery_location: formData.delivery_location ? (typeof formData.delivery_location === 'number' ? String(formData.delivery_location) : formData.delivery_location) : null,
          delivery_nature: formData.delivery_nature || null,
          fba: formData.fba || null,
          notes: formData.notes || null,
          po: formData.po || null,
          window_period: formData.window_period || null,
          order_id: orderId,
        } as any)
      } catch (error) {
        // 错误已在onSave中处理
      } finally {
        setIsSaving(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加仓点明细</DialogTitle>
            <DialogDescription>
              填写仓点明细信息，预计板数和分仓占比将自动计算
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">数量 *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                placeholder="请输入数量"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume">体积 *</Label>
              <Input
                id="volume"
                type="number"
                step="0.01"
                value={formData.volume}
                onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                placeholder="请输入体积（支持小数点）"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_location">送仓地点 *</Label>
              <LocationSelect
                value={formData.delivery_location ? (typeof formData.delivery_location === 'number' ? String(formData.delivery_location) : formData.delivery_location) : null}
                onChange={(value) => setFormData({ ...formData, delivery_location: value ? (typeof value === 'number' ? value : parseInt(value)) : null })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_nature">性质 *</Label>
              <Select
                value={formData.delivery_nature}
                onValueChange={(value) => setFormData({ ...formData, delivery_nature: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择性质" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMZ">AMZ</SelectItem>
                  <SelectItem value="扣货">扣货</SelectItem>
                  <SelectItem value="已放行">已放行</SelectItem>
                  <SelectItem value="私仓">私仓</SelectItem>
                  <SelectItem value="转仓">转仓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fba">FBA</Label>
              <Input
                id="fba"
                type="text"
                value={formData.fba}
                onChange={(e) => setFormData({ ...formData, fba: e.target.value })}
                placeholder="请输入FBA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="请输入备注"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po">PO</Label>
              <Input
                id="po"
                type="text"
                value={formData.po}
                onChange={(e) => setFormData({ ...formData, po: e.target.value })}
                placeholder="请输入PO（可选）"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="window_period">窗口期</Label>
              <Input
                id="window_period"
                type="text"
                value={formData.window_period}
                onChange={(e) => setFormData({ ...formData, window_period: e.target.value })}
                placeholder="请输入窗口期（可选）"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // 显示多步骤表单（用于添加 order_detail）
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            添加预约明细
          </DialogTitle>
          <DialogDescription className="text-base">
            {step === 1 && '第一步：搜索并选择柜号'}
            {step === 2 && '第二步：从明细行中选择一个仓点'}
            {step === 3 && (appointmentId ? '第三步：填写预计板数和PO' : '第三步：填写预计板数（PO从订单明细读取，不可编辑）')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 步骤1：选择柜号 */}
          {step === 1 && (
            <div className="space-y-2">
              <Label>柜号 *</Label>
              <FuzzySearchSelect
                value={selectedOrderId}
                onChange={(value) => {
                  if (value) {
                    const order = orders.find(o => String(o.order_id) === String(value))
                    if (order) {
                      handleSelectOrder(order.order_id, order.order_number)
                    } else {
                      // 如果 orders 中没有，可能是新搜索的结果，需要重新加载
                      // 这种情况不应该发生，因为 loadOptions 会更新 orders
                      console.warn('未找到对应的订单:', value)
                    }
                  }
                }}
                placeholder="搜索并选择柜号..."
                searchPlaceholder="搜索柜号..."
                emptyText="未找到订单"
                loadingText="搜索中..."
                loadOptions={async (search: string) => {
                  if (!search || search.trim().length === 0) {
                    return []
                  }
                  setIsLoadingOrders(true)
                  try {
                    const response = await fetch(`/api/oms/appointments/order-options?search=${encodeURIComponent(search)}`)
                    if (response.ok) {
                      const data = await response.json()
                      const loadedOrders = (data.data || []).map((order: any) => ({
                        value: order.order_id,
                        label: order.order_number,
                      }))
                      // 更新 orders 状态，以便 onChange 可以找到对应的订单
                      setOrders(data.data || [])
                      return loadedOrders
                    }
                    return []
                  } catch (error) {
                    console.error('搜索订单失败:', error)
                    return []
                  } finally {
                    setIsLoadingOrders(false)
                  }
                }}
                displayValue={(option) => option?.label || selectedOrderNumber || ''}
                icon={<Search className="h-3 w-3" />}
                className="w-full"
              />
            </div>
          )}

          {/* 步骤2：选择明细行 */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">已选择柜号：<span className="text-blue-600 dark:text-blue-400">{selectedOrderNumber}</span></Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep(1)
                    setSelectedOrderId(null)
                    setSelectedOrderNumber('')
                    setOrderDetails([])
                  }}
                  className="text-xs"
                >
                  重新选择
                </Button>
              </div>
              {isLoadingDetails ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                    <span>加载明细中...</span>
                  </div>
                </div>
              ) : orderDetails.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                    <Search className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">该订单暂无明细</p>
                  <p className="text-xs text-muted-foreground">请选择其他订单</p>
                </div>
              ) : (
                <div className="border border-border/50 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-900/80">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 sticky top-0 z-10 border-b border-border/50">
                        <tr>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">仓点</th>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">仓点类型</th>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">总方数</th>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">总板数</th>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">备注</th>
                          <th className="text-left p-3 font-semibold text-sm text-foreground">窗口期</th>
                          <th className="text-left p-3 font-semibold text-sm w-24">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...orderDetails].sort((a, b) => {
                          // 如果提供了 appointmentId，地点一致的优先显示
                          if (appointmentId) {
                            const aMatches = a.matches_appointment_destination === true
                            const bMatches = b.matches_appointment_destination === true
                            if (aMatches && !bMatches) return -1 // a 地点一致，b 不一致，a 排在前面
                            if (!aMatches && bMatches) return 1  // a 地点不一致，b 一致，b 排在前面
                          }
                          // 其他情况保持原顺序
                          return 0
                        }).map((detail) => {
                          // 总板数：优先使用实时的 remaining_pallets（API 返回的实时值），否则使用快照或预计板数
                          const totalPallets = detail.remaining_pallets ?? (detail as any).total_pallets_at_time ?? (detail.has_inventory 
                            ? (detail.inventory_pallets || 0)
                            : (detail.estimated_pallets || 0))
                          const isSelected = selectedDetailId === detail.id
                          
                          return (
                            <tr 
                              key={detail.id}
                              className={cn(
                                "border-b border-border/30 transition-all duration-200",
                                "hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20",
                                isSelected && "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-l-4 border-l-blue-500"
                              )}
                            >
                              <td className="p-3 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{detail.location_code || '-'}</span>
                                  {appointmentId && detail.matches_appointment_destination === false && (
                                    <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                                      地点不一致
                                    </Badge>
                                  )}
                                  {appointmentId && detail.matches_appointment_destination === true && (
                                    <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
                                      地点一致
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-sm">{detail.delivery_nature === '亚马逊' ? 'AMZ' : (detail.delivery_nature || '-')}</td>
                              <td className="p-3 text-sm">{formatVolume(detail.volume)}</td>
                              <td className="p-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{totalPallets}</span>
                                  {detail.has_inventory && (
                                    <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">库存</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {detail.notes || '-'}
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {(detail as any).window_period || '-'}
                              </td>
                              <td className="p-3 text-sm">
                                <Button
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => handleSelectDetail(detail)}
                                  className={cn(
                                    "transition-all duration-200",
                                    isSelected && "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
                                  )}
                                >
                                  {isSelected ? '已选择' : '选择'}
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 步骤3：填写预计板数和PO */}
          {step === 3 && selectedDetail && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 rounded-lg border border-border/50 shadow-sm space-y-3">
                <div className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/30">明细信息</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">柜号：</span>
                    <span className="font-medium text-foreground ml-2">{selectedOrderNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">仓点：</span>
                    <span className="font-medium text-foreground ml-2">{selectedDetail.location_code || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">仓点类型：</span>
                    <span className="font-medium text-foreground ml-2">{selectedDetail.delivery_nature === '亚马逊' ? 'AMZ' : (selectedDetail.delivery_nature || '-')}</span>
                  </div>
                  {/* 总方数不需要显示 */}
                  <div>
                    <span className="text-muted-foreground">剩余板数：</span>
                    <div className="inline-flex items-center gap-2 ml-2">
                      <span className="font-medium text-foreground">
                        {selectedDetail.remaining_pallets ?? (selectedDetail as any).total_pallets_at_time ?? (selectedDetail.has_inventory 
                          ? (selectedDetail.inventory_pallets || 0)
                          : (selectedDetail.estimated_pallets || 0))}
                      </span>
                      {selectedDetail.has_inventory && (
                        <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">库存</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PO：</span>
                    <span className="font-medium text-foreground ml-2">{selectedDetail.po || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">窗口期：</span>
                    <span className="font-medium text-foreground ml-2">{selectedDetail.window_period || '-'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-estimated_pallets" className="text-sm font-semibold">
                    预计板数 *
                    {selectedDetail && (
                      <span className="text-muted-foreground text-xs ml-2 font-normal">
                        (范围: 1 - {selectedDetail.remaining_pallets ?? (selectedDetail as any).total_pallets_at_time ?? (selectedDetail.has_inventory 
                          ? (selectedDetail.inventory_pallets || 0)
                          : (selectedDetail.estimated_pallets || 0))})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="add-estimated_pallets"
                    type="number"
                    value={estimatedPallets}
                    onChange={(e) => setEstimatedPallets(e.target.value)}
                    placeholder="请输入预计板数"
                    min="1"
                    max={selectedDetail ? (selectedDetail.remaining_pallets ?? (selectedDetail as any).total_pallets_at_time ?? (selectedDetail.has_inventory 
                      ? (selectedDetail.inventory_pallets || 0)
                      : (selectedDetail.estimated_pallets || 0))) : undefined}
                    className="h-10"
                  />
                </div>

                {/* PO 从 order_detail.po 读取，不需要输入（预约明细中） */}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              if (step > 1) {
                setStep((step - 1) as 1 | 2 | 3)
              } else {
                onOpenChange(false)
              }
            }} 
            disabled={isSaving}
          >
            {step > 1 ? '上一步' : '取消'}
          </Button>
          {step < 3 ? (
            <Button 
              onClick={() => {
                if (step === 1 && selectedOrderId) {
                  // 已经在handleSelectOrder中处理
                } else if (step === 2 && selectedDetailId) {
                  // 已经在handleSelectDetail中处理
                }
              }}
              disabled={!selectedOrderId || (step === 2 && !selectedDetailId)}
            >
              下一步
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* 送仓地点不一致警告对话框 */}
      <Dialog open={showDestinationMismatchDialog} onOpenChange={setShowDestinationMismatchDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-amber-600 dark:text-amber-400">送仓地点不一致</DialogTitle>
            <DialogDescription>
              您选择的明细行的送仓地点与预约目的地不一致，是否继续？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">预约目的地：</span>
                  <span className="font-medium text-foreground">
                    {appointmentDestination?.location_code || '未知'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">明细送仓地点：</span>
                  <span className="font-medium text-foreground">
                    {pendingDetailSelection?.location_code || '未知'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              通常情况下，明细行的送仓地点应该与预约目的地一致。如果确实需要选择不一致的明细，请确认后继续。
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDestinationMismatchDialog(false)
                setPendingDetailSelection(null)
              }}
            >
              取消
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                if (pendingDetailSelection) {
                  confirmDetailSelection(pendingDetailSelection)
                  setShowDestinationMismatchDialog(false)
                  setPendingDetailSelection(null)
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              确认继续
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// 编辑SKU明细弹窗组件
function EditSkuDialog({
  open,
  onOpenChange,
  sku,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: any | null
  onSave: (data: {
    detail_name: string
    sku: string
    description?: string | null
    stock_quantity?: number | null
    volume?: number | null
    status?: string | null
    fba?: string | null
  }) => Promise<void>
}) {
  const [detailName, setDetailName] = React.useState<string>('')
  const [skuCode, setSkuCode] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stockQuantity, setStockQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('active')
  const [fba, setFba] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (sku) {
      setDetailName(sku.detail_name || '')
      setSkuCode(sku.sku || '')
      setDescription(sku.description || '')
      setStockQuantity(sku.stock_quantity?.toString() || '')
      setVolume(sku.volume?.toString() || '')
      setStatus(sku.status || 'active')
      setFba(sku.fba || '')
    }
  }, [sku])

  React.useEffect(() => {
    if (!open) {
      setDetailName('')
      setSkuCode('')
      setDescription('')
      setStockQuantity('')
      setVolume('')
      setStatus('active')
      setFba('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!detailName || !skuCode) {
      toast.error('请输入明细名称和SKU')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        detail_name: detailName,
        sku: skuCode,
        description: description || null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : null,
        volume: volume ? parseFloat(volume) : null,
        status: status || null,
        fba: fba || null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  if (!sku) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑SKU明细</DialogTitle>
          <DialogDescription>修改SKU的详细信息。SKU ID: {sku.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-detail-name">明细名称 *</Label>
            <Input
              id="edit-detail-name"
              value={detailName}
              onChange={(e) => setDetailName(e.target.value)}
              placeholder="请输入明细名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sku">SKU *</Label>
            <Input
              id="edit-sku"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="请输入SKU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">描述</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入描述"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-stock-quantity">库存数量</Label>
            <Input
              id="edit-stock-quantity"
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="请输入库存数量"
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-volume">体积</Label>
            <Input
              id="edit-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-status">状态</Label>
            <Input
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="请输入状态"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-fba">FBA</Label>
            <Input
              id="edit-fba"
              value={fba}
              onChange={(e) => setFba(e.target.value)}
              placeholder="请输入FBA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 添加SKU明细弹窗组件
function AddSkuDialog({
  open,
  onOpenChange,
  detailId,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailId: string | number | null
  onSave: (data: {
    detail_name: string
    sku: string
    description?: string | null
    stock_quantity?: number | null
    volume?: number | null
    status?: string | null
    fba?: string | null
  }) => Promise<void>
}) {
  const [detailName, setDetailName] = React.useState<string>('')
  const [skuCode, setSkuCode] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stockQuantity, setStockQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('active')
  const [fba, setFba] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setDetailName('')
      setSkuCode('')
      setDescription('')
      setStockQuantity('')
      setVolume('')
      setStatus('active')
      setFba('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!detailName || !skuCode) {
      toast.error('请输入明细名称和SKU')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        detail_name: detailName,
        sku: skuCode,
        description: description || null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : null,
        volume: volume ? parseFloat(volume) : null,
        status: status || null,
        fba: fba || null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加SKU明细</DialogTitle>
          <DialogDescription>请输入SKU的详细信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="add-detail-name">明细名称 *</Label>
            <Input
              id="add-detail-name"
              value={detailName}
              onChange={(e) => setDetailName(e.target.value)}
              placeholder="请输入明细名称（唯一）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-sku">SKU *</Label>
            <Input
              id="add-sku"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="请输入SKU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-description">描述</Label>
            <Input
              id="add-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入描述"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-stock-quantity">库存数量</Label>
            <Input
              id="add-stock-quantity"
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="请输入库存数量"
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-volume">体积</Label>
            <Input
              id="add-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-status">状态</Label>
            <Input
              id="add-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="请输入状态"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-fba">FBA</Label>
            <Input
              id="add-fba"
              value={fba}
              onChange={(e) => setFba(e.target.value)}
              placeholder="请输入FBA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

