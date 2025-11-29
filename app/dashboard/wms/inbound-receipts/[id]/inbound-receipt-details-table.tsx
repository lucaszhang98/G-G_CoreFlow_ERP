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
import { ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"

interface OrderDetail {
  id: string
  order_id: string | null
  quantity: number
  volume: number | null
  container_volume: number | null
  estimated_pallets: number | null
  delivery_nature: string | null
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
  onRefresh: () => void
}

export function InboundReceiptDetailsTable({
  inboundReceiptId,
  orderDetails,
  inventoryLots,
  deliveryAppointments,
  onRefresh,
}: InboundReceiptDetailsTableProps) {
  // 展开状态管理
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

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
  // 计算总柜体积
  const totalContainerVolume = orderDetails.reduce((sum, detail) => {
    return sum + (detail.container_volume || 0)
  }, 0)

  // 将inventory_lots按order_detail_id分组
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

  // 计算分仓占总柜比
  const calculatePercentage = (containerVolume: number | null) => {
    if (!containerVolume || totalContainerVolume === 0) return null
    return (containerVolume / totalContainerVolume) * 100
  }

  // 获取该仓点的库存信息（合并所有inventory_lots）
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

  // 获取送仓地点（从第一个inventory_lot获取）
  const getDeliveryLocation = (detailId: string) => {
    const lots = lotsByDetailId.get(detailId) || []
    return lots[0]?.delivery_location || null
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderDetails.map((detail) => {
            const inventoryInfo = getInventoryInfo(detail.id)
            const deliveryLocation = getDeliveryLocation(detail.id)
            const percentage = calculatePercentage(detail.container_volume)
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
                    {inventoryInfo.storage_location_code || "-"}
                  </TableCell>
                  <TableCell>
                    {inventoryInfo.total_pallet_count > 0 ? formatNumber(inventoryInfo.total_pallet_count) : "-"}
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
    </div>
  )
}

