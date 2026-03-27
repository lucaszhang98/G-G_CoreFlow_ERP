"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react"
import Link from "next/link"
// 移除 Dialog 导入，改用内联编辑
import { toast } from "sonner"
import { computeInboundOrderDetailDeliveryState } from "@/lib/utils/inbound-delivery-progress"

interface OrderDetail {
  id: string
  order_id: string | null
  quantity: number
  volume: number | null
  container_volume: number | null
  estimated_pallets: number | null
  delivery_nature: string | null
  volume_percentage: number | null // 分仓占比（从数据库自动生成）
  delivery_location?: string | null // 添加送仓地点
  notes?: string | null // 备注字段
  appointments?: DeliveryAppointment[] // 该订单明细关联的预约
}

interface InventoryLot {
  inventory_lot_id: string
  order_detail_id: string
  storage_location_code: string | null
  /** null = 未填（计算按预计板数），0 = 明确为零 */
  pallet_count: number | null
  pallet_counts_verified?: boolean
  remaining_pallet_count: number
  unbooked_pallet_count: number
  delivery_progress: number | null
  unload_transfer_notes: string | null
  notes: string | null
  order_detail: {
    id: string
    delivery_nature: string | null
    container_volume: number | null
    volume: number | null
    estimated_pallets: number | null
  } | null
  delivery_location: string | null
}

interface DeliveryAppointment {
  appointment_id: string | null
  order_id: string | null
  reference_number: string | null
  confirmed_start: string | null
  location_id: string | null
  status: string | null
  estimated_pallets?: number // 预约明细的预计板数
  rejected_pallets?: number // 拒收板数，有效占用 = estimated_pallets - rejected_pallets
}

interface InboundReceiptDetailsTableProps {
  inboundReceiptId: string
  orderDetails: OrderDetail[]
  inventoryLots: InventoryLot[]
  warehouseId: string // 添加 warehouse_id
  onRefresh: () => void
}

type BatchEditRow = {
  storage_location_code: string
  /** null = 未填实际板数（保存后存库 null，计算按预计）；0 = 明确为零 */
  pallet_count: number | null
  notes: string
}

/** 列表「实际板数」展示：单条取原值；多条若存在未填则显示为未填（由 formatInteger 显示为 -） */
function aggregateStoredPalletCountForDisplay(lots: InventoryLot[]): number | null {
  if (lots.length === 0) return null
  if (lots.length === 1) return lots[0].pallet_count ?? null
  if (lots.some((l) => l.pallet_count === null || l.pallet_count === undefined)) return null
  return lots.reduce((s, l) => s + Number(l.pallet_count), 0)
}

function normalizeBatchRow(r: BatchEditRow) {
  let pal: number | null
  if (r.pallet_count === null || r.pallet_count === undefined) {
    pal = null
  } else {
    const n = Number(r.pallet_count)
    pal = Number.isFinite(n) ? n : null
  }
  return {
    loc: (r.storage_location_code ?? '').trim(),
    pal,
    notes: (r.notes ?? '').trim(),
  }
}

/** 与进入批量编辑时的快照对比，判断是否改动（含明确改为 0 板数） */
function isBatchRowDirty(current: BatchEditRow, baseline: BatchEditRow) {
  const c = normalizeBatchRow(current)
  const b = normalizeBatchRow(baseline)
  return c.loc !== b.loc || c.pal !== b.pal || c.notes !== b.notes
}

export function InboundReceiptDetailsTable({
  inboundReceiptId,
  orderDetails,
  inventoryLots,
  warehouseId,
  onRefresh,
}: InboundReceiptDetailsTableProps) {
  const router = useRouter()
  // 展开状态管理
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  // 批量编辑模式
  const [isBatchEditMode, setIsBatchEditMode] = React.useState(false)
  // 批量编辑值（按 detailId 管理所有行的编辑值）
  const [batchEditValues, setBatchEditValues] = React.useState<Record<string, BatchEditRow>>({})
  /** 进入批量编辑瞬间的快照，用于只保存有变更的明细行 */
  const batchEditBaselineRef = React.useRef<Record<string, BatchEditRow> | null>(null)
  // 单行编辑状态管理（保留兼容性）
  const [editingDetailId, setEditingDetailId] = React.useState<string | null>(null)
  const [editingValues, setEditingValues] = React.useState<{
    storage_location_code: string
    pallet_count: number | null
    notes: string
  } | null>(null)

  // 切换展开/收起
  const toggleExpand = (detailId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(detailId)) {
        next.delete(detailId)
      } else {
        next.add(detailId)
      }
      return next
    })
  }
  // 总柜体积计算（用于显示，但分仓占比现在从数据库读取）
  // 注意：volume_percentage 现在由数据库触发器自动计算

  // 将inventory_lots按order_detail_id分组（需要在其他函数之前定义）
  const lotsByDetailId = React.useMemo(() => {
    const map = new Map<string, InventoryLot[]>()
    inventoryLots.forEach(lot => {
      const detailId = lot.order_detail_id
      if (!map.has(detailId)) {
        map.set(detailId, [])
      }
      map.get(detailId)!.push(lot)
    })
    return map
  }, [inventoryLots])

  // 获取该仓点的库存信息（从inventory_lots读取）
  const getInventoryInfo = (detailId: string) => {
    const lots = lotsByDetailId.get(detailId) || []
    if (lots.length === 0) {
      return {
        storage_location_code: null,
        stored_pallet_count: null,
        total_remaining_pallet_count: 0,
        total_unbooked_pallet_count: 0,
        delivery_progress: null,
        unload_transfer_notes: null,
        notes: null,
      }
    }

    const detail = orderDetails.find(d => d.id === detailId)
    const appointments = detail?.appointments || []
    const appointmentInputs = appointments.map((a: DeliveryAppointment) => ({
      confirmed_start: a.confirmed_start,
      estimated_pallets: a.estimated_pallets,
      rejected_pallets: a.rejected_pallets ?? 0,
    }))

    // 与订单明细 API（/api/oms/order-details）一致：已入库行统一用 computeInboundOrderDetailDeliveryState
    // （基准板数 + 已到期预约有效板数），避免单批次时「DB remaining + 过期预约」混合算法与订单明细 100% / 详情 50% 不一致
    const state = computeInboundOrderDetailDeliveryState({
      lots: lots.map((l) => ({
        pallet_count: l.pallet_count,
        pallet_counts_verified: l.pallet_counts_verified === true,
        remaining_pallet_count: l.remaining_pallet_count,
        unbooked_pallet_count: l.unbooked_pallet_count,
      })),
      estimatedPallets: detail?.estimated_pallets,
      appointments: appointmentInputs,
    })
    const totalRemainingPalletCount = state?.totalRemainingPalletCount ?? 0
    const totalUnbookedPalletCount = state?.totalUnbookedPalletCount ?? 0
    const avgDeliveryProgress: number | null = state?.deliveryProgress ?? null

    // 合并备注（取第一个非空的）
    const unloadTransferNotes = lots.find(lot => lot.unload_transfer_notes)?.unload_transfer_notes || null
    const notes = lots.find(lot => lot.notes)?.notes || null

    // 仓库位置（取第一个非空的）
    const storageLocationCode = lots.find(lot => lot.storage_location_code)?.storage_location_code || null

    return {
      storage_location_code: storageLocationCode,
      // 列表「实际板数」：库内原值（null=未填显示 -，0 显示 0）
      stored_pallet_count: aggregateStoredPalletCountForDisplay(lots),
      total_remaining_pallet_count: totalRemainingPalletCount,
      total_unbooked_pallet_count: totalUnbookedPalletCount,
      delivery_progress: avgDeliveryProgress,
      unload_transfer_notes: unloadTransferNotes,
      notes: notes,
    }
  }

  // 初始化批量编辑值
  const initializeBatchEditValues = () => {
    const values: Record<string, BatchEditRow> = {}

    orderDetails.forEach(detail => {
      const existingLots = lotsByDetailId.get(detail.id) || []

      let initialPalletCount: number | null = null
      let initialStorageLocation = ''
      const initialNotes = detail.notes || ''

      if (existingLots.length > 0) {
        initialPalletCount = existingLots[0].pallet_count ?? null
        initialStorageLocation = existingLots[0].storage_location_code || ''
      }

      values[detail.id] = {
        storage_location_code: initialStorageLocation,
        pallet_count: initialPalletCount,
        notes: initialNotes,
      }
    })

    batchEditBaselineRef.current = Object.fromEntries(
      Object.entries(values).map(([id, row]) => [
        id,
        {
          storage_location_code: row.storage_location_code,
          pallet_count: row.pallet_count,
          notes: row.notes,
        },
      ])
    )
    setBatchEditValues(values)
  }

  // 开启批量编辑模式
  const handleStartBatchEdit = () => {
    initializeBatchEditValues()
    setIsBatchEditMode(true)
    // 退出单行编辑模式
    setEditingDetailId(null)
    setEditingValues(null)
  }

  // 取消批量编辑
  const handleCancelBatchEdit = () => {
    setIsBatchEditMode(false)
    setBatchEditValues({})
    batchEditBaselineRef.current = null
  }

  // 批量保存（仅提交相对进入批量编辑时有变更的明细行，未改动的不请求接口）
  const handleBatchSave = async () => {
    try {
      const baseline = batchEditBaselineRef.current
      if (!baseline) {
        toast.error('批量编辑状态异常，请取消后重新进入批量编辑')
        return
      }

      const savePromises: Promise<void>[] = []
      let dirtyCount = 0

      for (const detailId of Object.keys(batchEditValues)) {
        const values = batchEditValues[detailId]
        const base = baseline[detailId]
        if (!base || !isBatchRowDirty(values, base)) continue

        const orderDetail = orderDetails.find(d => d.id === detailId)
        if (!orderDetail) continue

        dirtyCount += 1
        const c = normalizeBatchRow(values)
        const b = normalizeBatchRow(base)
        const notesDirty = c.notes !== b.notes
        const palletDirty = c.pal !== b.pal
        const inventoryDirty = c.loc !== b.loc || palletDirty

        const savePromise = (async () => {
          if (notesDirty) {
            const notesResponse = await fetch(`/api/order-details/${detailId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notes: values.notes || null,
              }),
            })

            if (!notesResponse.ok) {
              const errorData = await notesResponse.json()
              throw new Error(`更新备注失败: ${errorData.error || '未知错误'}`)
            }
          }

          if (!inventoryDirty) return

          const existingLots = lotsByDetailId.get(detailId) || []
          const palletPayload = normalizeBatchRow(values).pal

          if (existingLots.length > 0) {
            if (existingLots.length === 1) {
              const firstLot = existingLots[0]
              const response = await fetch(`/api/wms/inventory-lots/${firstLot.inventory_lot_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  storage_location_code: values.storage_location_code || null,
                  pallet_count: palletPayload,
                }),
              })

              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(`更新失败: ${errorData.error || '未知错误'}`)
              }
            } else {
              const firstLot = existingLots[0]
              const response = await fetch(`/api/wms/inventory-lots/${firstLot.inventory_lot_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  storage_location_code: values.storage_location_code || null,
                  pallet_count: palletPayload,
                }),
              })

              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(`更新失败: ${errorData.error || '未知错误'}`)
              }

              for (let i = 1; i < existingLots.length; i++) {
                const lotToDelete = existingLots[i]
                const deleteResponse = await fetch(`/api/wms/inventory-lots/${lotToDelete.inventory_lot_id}`, {
                  method: 'DELETE',
                })
                if (!deleteResponse.ok) {
                  console.warn(`删除重复库存批次 ${lotToDelete.inventory_lot_id} 失败`)
                }
              }
            }
          } else {
            const response = await fetch('/api/wms/inventory-lots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderDetail.order_id,
                order_detail_id: detailId,
                warehouse_id: warehouseId,
                inbound_receipt_id: inboundReceiptId,
                storage_location_code: values.storage_location_code || null,
                pallet_count: normalizeBatchRow(values).pal,
                remaining_pallet_count: 0,
                unbooked_pallet_count: 0,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(`创建失败: ${errorData.error || '未知错误'}`)
            }
          }
        })()

        savePromises.push(savePromise)
      }

      if (dirtyCount === 0) {
        toast.info('未检测到变更，未写入任何数据')
        setIsBatchEditMode(false)
        setBatchEditValues({})
        batchEditBaselineRef.current = null
        return
      }

      await Promise.all(savePromises)

      toast.success(`已保存 ${dirtyCount} 条有修改的明细`)
      setIsBatchEditMode(false)
      setBatchEditValues({})
      batchEditBaselineRef.current = null
      onRefresh()
    } catch (error: any) {
      console.error('批量保存失败:', error)
      toast.error(error.message || '批量保存失败')
    }
  }

  // 开始编辑（单行编辑模式，保留兼容性）
  const handleStartEdit = (detailId: string) => {
    if (isBatchEditMode) return // 批量编辑模式下不允许单行编辑
    
    const inventoryInfo = getInventoryInfo(detailId)
    const existingLots = lotsByDetailId.get(detailId) || []
    const orderDetail = orderDetails.find(d => d.id === detailId)
    
    let initialPalletCount: number | null = null
    let initialStorageLocation = inventoryInfo.storage_location_code || ''
    let initialNotes = orderDetail?.notes || ''
    
    if (existingLots.length > 0) {
      initialPalletCount = existingLots[0].pallet_count ?? null
      initialStorageLocation = existingLots[0].storage_location_code || ''
    }
    
    setEditingDetailId(detailId)
    setEditingValues({
      storage_location_code: initialStorageLocation,
      pallet_count: initialPalletCount,
      notes: initialNotes,
    })
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingDetailId(null)
    setEditingValues(null)
  }

  // 保存编辑
  const handleSaveEdit = async (detailId: string) => {
    if (!editingValues) return

    try {
      // 找到对应的 order_detail 以获取 order_id
      const orderDetail = orderDetails.find(d => d.id === detailId)
      if (!orderDetail) {
        toast.error('找不到对应的订单明细')
        return
      }

      // 先更新订单明细的备注
      if (editingValues.notes !== undefined) {
        const notesResponse = await fetch(`/api/order-details/${detailId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: editingValues.notes || null,
          }),
        })

        if (!notesResponse.ok) {
          const errorData = await notesResponse.json()
          throw new Error(errorData.error || '更新备注失败')
        }
      }

      // 检查是否已有库存批次记录
      const existingLots = lotsByDetailId.get(detailId) || []
      
      if (existingLots.length > 0) {
        // 有现有记录
        if (existingLots.length === 1) {
          // 只有一个记录，直接更新
          const firstLot = existingLots[0]
          const response = await fetch(`/api/wms/inventory-lots/${firstLot.inventory_lot_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storage_location_code: editingValues.storage_location_code || null,
              pallet_count:
                editingValues.pallet_count == null
                  ? null
                  : Number(editingValues.pallet_count),
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || '更新失败')
          }
        } else {
          // 有多个记录，需要合并：更新第一个，删除其他的
          // 先更新第一个记录
          const firstLot = existingLots[0]
          const response = await fetch(`/api/wms/inventory-lots/${firstLot.inventory_lot_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storage_location_code: editingValues.storage_location_code || null,
              pallet_count:
                editingValues.pallet_count == null
                  ? null
                  : Number(editingValues.pallet_count),
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || '更新失败')
          }

          // 删除其他重复的记录
          for (let i = 1; i < existingLots.length; i++) {
            const lotToDelete = existingLots[i]
            const deleteResponse = await fetch(`/api/wms/inventory-lots/${lotToDelete.inventory_lot_id}`, {
              method: 'DELETE',
            })
            if (!deleteResponse.ok) {
              console.warn(`删除重复库存批次 ${lotToDelete.inventory_lot_id} 失败`)
            }
          }
        }
      } else {
        // 没有现有记录，创建新的
        const response = await fetch('/api/wms/inventory-lots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderDetail.order_id,
            order_detail_id: detailId,
            warehouse_id: warehouseId,
            inbound_receipt_id: inboundReceiptId,
            storage_location_code: editingValues.storage_location_code || null,
            pallet_count: editingValues.pallet_count == null ? null : Number(editingValues.pallet_count),
            remaining_pallet_count: 0,
            unbooked_pallet_count: 0,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '创建失败')
        }
      }

      toast.success('保存成功')
      setEditingDetailId(null)
      setEditingValues(null)
      onRefresh()
    } catch (error: any) {
      console.error('保存失败:', error)
      toast.error(error.message || '保存失败')
    }
  }

  // 格式化数字（千分位）
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

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return "-"
    return `${Number(value).toFixed(2)}%`
  }

  // 分仓占比现在从数据库自动生成，不再需要计算

  // 获取送仓地点（直接从 order_detail 获取）
  const getDeliveryLocation = (detail: OrderDetail) => {
    return detail.delivery_location || null
  }

  // 获取该订单明细对应的送仓预约（直接从 orderDetail.appointments 获取）
  const getAppointmentsForDetail = (detailId: string) => {
    const detail = orderDetails.find(d => d.id === detailId)
    return detail?.appointments || []
  }

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "-"
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch {
      return "-"
    }
  }

  if (!orderDetails || orderDetails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无仓点信息
      </div>
    )
  }

  // 按分仓占比倒序排列（使用数据库字段）
  const sortedOrderDetails = React.useMemo(() => {
    return [...orderDetails].sort((a, b) => {
      const percentageA = a.volume_percentage || 0
      const percentageB = b.volume_percentage || 0
      return percentageB - percentageA // 倒序
    })
  }, [orderDetails])

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={isBatchEditMode ? 12 : 13} className="h-12">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">仓点明细</span>
                {isBatchEditMode ? (
                  <div className="flex items-center gap-2">
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
                  </div>
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
                )}
              </div>
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>性质</TableHead>
            <TableHead>送仓地点</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>预估板数</TableHead>
            <TableHead>分仓占比</TableHead>
            <TableHead>仓库位置</TableHead>
            <TableHead>实际板数</TableHead>
            <TableHead>剩余板数</TableHead>
            <TableHead>送货进度</TableHead>
            <TableHead>FBA</TableHead>
            <TableHead>备注</TableHead>
            {!isBatchEditMode && <TableHead className="w-20">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrderDetails.map((detail) => {
            const inventoryInfo = getInventoryInfo(detail.id)
            const deliveryLocation = getDeliveryLocation(detail)
            const percentage = detail.volume_percentage // 使用数据库字段
            const isExpanded = expandedRows.has(detail.id)
            const appointments = getAppointmentsForDetail(detail.id)

            return (
              <React.Fragment key={detail.id}>
                {/* 主行：仓点明细 */}
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleExpand(detail.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {detail.delivery_nature === '亚马逊' ? 'AMZ' : (detail.delivery_nature || "-")}
                  </TableCell>
                  <TableCell>
                    {deliveryLocation || "-"}
                  </TableCell>
                  <TableCell>
                    {formatVolume(detail.container_volume)}
                  </TableCell>
                  <TableCell>
                    {formatInteger(detail.estimated_pallets)}
                  </TableCell>
                  <TableCell>
                    {percentage !== null ? formatPercentage(percentage) : "-"}
                  </TableCell>
                  <TableCell>
                    {(isBatchEditMode || editingDetailId === detail.id) ? (
                      <Input
                        value={
                          isBatchEditMode
                            ? (batchEditValues[detail.id]?.storage_location_code || '')
                            : (editingValues?.storage_location_code || '')
                        }
                        onChange={(e) => {
                          if (isBatchEditMode) {
                            setBatchEditValues(prev => {
                              const currentValues = prev[detail.id] || {
                                storage_location_code: '',
                                pallet_count: null,
                                notes: '',
                              }
                              return {
                                ...prev,
                                [detail.id]: {
                                  ...currentValues,
                                  storage_location_code: e.target.value,
                                }
                              }
                            })
                          } else {
                            setEditingValues(prev => prev ? {
                              ...prev,
                              storage_location_code: e.target.value
                            } : null)
                          }
                        }}
                        placeholder="仓库位置"
                        className="w-full"
                      />
                    ) : (
                      inventoryInfo.storage_location_code || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {(isBatchEditMode || editingDetailId === detail.id) ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={(() => {
                          const raw = isBatchEditMode
                            ? batchEditValues[detail.id]?.pallet_count
                            : editingValues?.pallet_count
                          if (raw === null || raw === undefined) return ''
                          return String(raw)
                        })()}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || value === null || value === undefined) {
                            if (isBatchEditMode) {
                              setBatchEditValues(prev => {
                                const currentValues = prev[detail.id] || {
                                  storage_location_code: '',
                                  pallet_count: null,
                                  notes: '',
                                }
                                return {
                                  ...prev,
                                  [detail.id]: {
                                    ...currentValues,
                                    pallet_count: null,
                                  }
                                }
                              })
                            } else {
                              setEditingValues(prev => prev ? {
                                ...prev,
                                pallet_count: null
                              } : null)
                            }
                            return
                          }
                          const numValue = parseInt(value, 10)
                          if (!isNaN(numValue) && numValue >= 0) {
                            if (isBatchEditMode) {
                              setBatchEditValues(prev => {
                                const currentValues = prev[detail.id] || {
                                  storage_location_code: '',
                                  pallet_count: null,
                                  notes: '',
                                }
                                return {
                                  ...prev,
                                  [detail.id]: {
                                    ...currentValues,
                                    pallet_count: numValue,
                                  }
                                }
                              })
                            } else {
                              setEditingValues(prev => prev ? {
                                ...prev,
                                pallet_count: numValue
                              } : null)
                            }
                          }
                        }}
                        placeholder="实际板数"
                        className="w-full"
                      />
                    ) : (
                      formatInteger(inventoryInfo.stored_pallet_count)
                    )}
                  </TableCell>
                  <TableCell>
                    {formatInteger(inventoryInfo.total_remaining_pallet_count)}
                  </TableCell>
                  <TableCell>
                    {inventoryInfo.delivery_progress !== null ? formatPercentage(inventoryInfo.delivery_progress) : "-"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {inventoryInfo.unload_transfer_notes || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {(isBatchEditMode || editingDetailId === detail.id) ? (
                      <Input
                        value={
                          isBatchEditMode
                            ? (batchEditValues[detail.id]?.notes || '')
                            : (editingValues?.notes || '')
                        }
                        onChange={(e) => {
                          if (isBatchEditMode) {
                            setBatchEditValues(prev => {
                              const currentValues = prev[detail.id] || {
                                storage_location_code: '',
                                pallet_count: null,
                                notes: '',
                              }
                              return {
                                ...prev,
                                [detail.id]: {
                                  ...currentValues,
                                  notes: e.target.value,
                                }
                              }
                            })
                          } else {
                            setEditingValues(prev => prev ? {
                              ...prev,
                              notes: e.target.value
                            } : null)
                          }
                        }}
                        placeholder="备注"
                        className="w-full"
                      />
                    ) : (
                      detail.notes || "-"
                    )}
                  </TableCell>
                  {!isBatchEditMode && (
                    <TableCell>
                      {editingDetailId === detail.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(detail.id)}
                            title="保存"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            title="取消"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(detail.id)}
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>

                {/* 展开行：送仓预约 */}
                {isExpanded && (
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={12} className="p-0">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold">
                            送仓预约 ({appointments.length})
                          </h4>
                        </div>
                        {appointments.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>送仓预约</TableHead>
                                <TableHead>预约号码</TableHead>
                                <TableHead>送仓日</TableHead>
                                <TableHead>预计板数</TableHead>
                                <TableHead>拒收板数</TableHead>
                                <TableHead>有效板数</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {appointments.map((appt, index) => {
                                const rej = appt.rejected_pallets ?? 0
                                const est = appt.estimated_pallets ?? 0
                                const effective = Math.max(0, est - rej)
                                return (
                                  <TableRow key={appt.appointment_id || `appt-${index}`}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      {appt.reference_number ? (
                                        <Link 
                                          href="#" 
                                          className="text-blue-600 hover:underline"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            if (appt.appointment_id) {
                                              router.push(`/dashboard/oms/appointments/${appt.appointment_id}`)
                                            }
                                          }}
                                        >
                                          {appt.reference_number}
                                        </Link>
                                      ) : (
                                        "-"
                                      )}
                                    </TableCell>
                                    <TableCell>{formatDate(appt.confirmed_start)}</TableCell>
                                    <TableCell>{formatInteger(est)}</TableCell>
                                    <TableCell>{formatInteger(rej)}</TableCell>
                                    <TableCell>{formatInteger(effective)}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无送仓预约
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>

      {/* 已移除 Dialog，改用内联编辑 */}
    </div>
  )
}

