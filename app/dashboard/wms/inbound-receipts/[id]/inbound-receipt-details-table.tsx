"use client"

import * as React from "react"
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

interface OrderDetail {
  id: string
  order_id: string | null
  quantity: number
  volume: number | null
  container_volume: number | null
  estimated_pallets: number | null
  delivery_nature: string | null
  volume_percentage: number | null // 分仓占总柜比（从数据库自动生成）
  delivery_location?: string | null // 添加送仓地点
}

interface InventoryLot {
  inventory_lot_id: string
  order_detail_id: string
  storage_location_code: string | null
  pallet_count: number
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
  appointment_id: string
  order_id: string | null
  reference_number: string | null
  confirmed_start: string | null
  location_id: string | null
  status: string | null
}

interface InboundReceiptDetailsTableProps {
  inboundReceiptId: string
  orderDetails: OrderDetail[]
  inventoryLots: InventoryLot[]
  deliveryAppointments: DeliveryAppointment[]
  warehouseId: string // 添加 warehouse_id
  onRefresh: () => void
}

export function InboundReceiptDetailsTable({
  inboundReceiptId,
  orderDetails,
  inventoryLots,
  deliveryAppointments,
  warehouseId,
  onRefresh,
}: InboundReceiptDetailsTableProps) {
  // 展开状态管理
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  // 编辑状态管理（按 detailId 管理）
  const [editingDetailId, setEditingDetailId] = React.useState<string | null>(null)
  const [editingValues, setEditingValues] = React.useState<{
    storage_location_code: string
    pallet_count: number
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
  // 总柜体积计算（用于显示，但分仓占总柜比现在从数据库读取）
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
        total_pallet_count: 0,
        total_remaining_pallet_count: 0,
        total_unbooked_pallet_count: 0,
        delivery_progress: null,
        unload_transfer_notes: null,
        notes: null,
      }
    }

    // 合并多个库存批次的信息
    const totalPalletCount = lots.reduce((sum, lot) => sum + (lot.pallet_count || 0), 0)
    const totalRemainingPalletCount = lots.reduce((sum, lot) => sum + (lot.remaining_pallet_count || 0), 0)
    const totalUnbookedPalletCount = lots.reduce((sum, lot) => sum + (lot.unbooked_pallet_count || 0), 0)
    
    // 计算平均送货进度
    const progressValues = lots.filter(lot => lot.delivery_progress !== null).map(lot => Number(lot.delivery_progress))
    const avgDeliveryProgress = progressValues.length > 0
      ? progressValues.reduce((sum, val) => sum + val, 0) / progressValues.length
      : null

    // 合并备注（取第一个非空的）
    const unloadTransferNotes = lots.find(lot => lot.unload_transfer_notes)?.unload_transfer_notes || null
    const notes = lots.find(lot => lot.notes)?.notes || null

    // 仓库位置（取第一个非空的）
    const storageLocationCode = lots.find(lot => lot.storage_location_code)?.storage_location_code || null

    return {
      storage_location_code: storageLocationCode,
      total_pallet_count: totalPalletCount,
      total_remaining_pallet_count: totalRemainingPalletCount,
      total_unbooked_pallet_count: totalUnbookedPalletCount,
      delivery_progress: avgDeliveryProgress,
      unload_transfer_notes: unloadTransferNotes,
      notes: notes,
    }
  }

  // 开始编辑
  const handleStartEdit = (detailId: string) => {
    const inventoryInfo = getInventoryInfo(detailId)
    setEditingDetailId(detailId)
    setEditingValues({
      storage_location_code: inventoryInfo.storage_location_code || '',
      pallet_count: inventoryInfo.total_pallet_count || 0,
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

      // 检查是否已有库存批次记录
      const existingLots = lotsByDetailId.get(detailId) || []
      
      if (existingLots.length > 0) {
        // 有现有记录，更新第一个（通常一个仓点只有一个库存批次）
        const firstLot = existingLots[0]
        const response = await fetch(`/api/wms/inventory-lots/${firstLot.inventory_lot_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_location_code: editingValues.storage_location_code || null,
            pallet_count: editingValues.pallet_count || 0,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '更新失败')
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
            pallet_count: editingValues.pallet_count || 0,
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

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return "-"
    return `${Number(value).toFixed(2)}%`
  }

  // 分仓占总柜比现在从数据库自动生成，不再需要计算


  // 获取送仓地点（直接从 order_detail 获取）
  const getDeliveryLocation = (detail: OrderDetail) => {
    return detail.delivery_location || null
  }

  // 获取该仓点对应的送仓预约（通过order_id匹配）
  const getAppointmentsForDetail = (orderId: string | null) => {
    if (!orderId) return []
    return deliveryAppointments.filter(appt => appt.order_id === orderId)
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

  // 按分仓占总柜比倒序排列（使用数据库字段）
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
            <TableHead className="w-12"></TableHead>
            <TableHead>性质</TableHead>
            <TableHead>送仓地点</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>预估板数</TableHead>
            <TableHead>分仓占总柜比</TableHead>
            <TableHead>仓库位置</TableHead>
            <TableHead>实际板数</TableHead>
            <TableHead>剩余板数</TableHead>
            <TableHead>送货进度</TableHead>
            <TableHead>拆柜/转仓</TableHead>
            <TableHead>备注</TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrderDetails.map((detail) => {
            const inventoryInfo = getInventoryInfo(detail.id)
            const deliveryLocation = getDeliveryLocation(detail)
            const percentage = detail.volume_percentage // 使用数据库字段
            const isExpanded = expandedRows.has(detail.id)
            const appointments = getAppointmentsForDetail(detail.order_id)

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
                    {detail.delivery_nature || "-"}
                  </TableCell>
                  <TableCell>
                    {deliveryLocation || "-"}
                  </TableCell>
                  <TableCell>
                    {formatNumber(detail.container_volume)} CBM
                  </TableCell>
                  <TableCell>
                    {detail.estimated_pallets ? formatNumber(detail.estimated_pallets) : "-"}
                  </TableCell>
                  <TableCell>
                    {percentage !== null ? formatPercentage(percentage) : "-"}
                  </TableCell>
                  <TableCell>
                    {editingDetailId === detail.id ? (
                      <Input
                        value={editingValues?.storage_location_code || ''}
                        onChange={(e) => setEditingValues(prev => prev ? {
                          ...prev,
                          storage_location_code: e.target.value
                        } : null)}
                        placeholder="仓库位置"
                        className="w-full"
                      />
                    ) : (
                      inventoryInfo.storage_location_code || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {editingDetailId === detail.id ? (
                      <Input
                        type="number"
                        min="0"
                        value={editingValues?.pallet_count || 0}
                        onChange={(e) => setEditingValues(prev => prev ? {
                          ...prev,
                          pallet_count: parseInt(e.target.value) || 0
                        } : null)}
                        placeholder="实际板数"
                        className="w-full"
                      />
                    ) : (
                      inventoryInfo.total_pallet_count > 0 ? formatNumber(inventoryInfo.total_pallet_count) : "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {inventoryInfo.total_remaining_pallet_count > 0 ? formatNumber(inventoryInfo.total_remaining_pallet_count) : "-"}
                  </TableCell>
                  <TableCell>
                    {inventoryInfo.delivery_progress !== null ? formatPercentage(inventoryInfo.delivery_progress) : "-"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {inventoryInfo.unload_transfer_notes || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {inventoryInfo.notes || "-"}
                  </TableCell>
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
                                <TableHead>板数</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {appointments.map((appt, index) => (
                                <TableRow key={appt.appointment_id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    {appt.reference_number ? (
                                      <Link 
                                        href="#" 
                                        className="text-blue-600 hover:underline"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          // TODO: 后续添加链接目标
                                        }}
                                      >
                                        {appt.reference_number}
                                      </Link>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell>{formatDate(appt.confirmed_start)}</TableCell>
                                  <TableCell>
                                    {/* 板数需要从inventory_lots获取，这里暂时显示"-"，后续可以根据业务逻辑填充 */}
                                    {inventoryInfo.total_pallet_count > 0 ? formatNumber(inventoryInfo.total_pallet_count) : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
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

