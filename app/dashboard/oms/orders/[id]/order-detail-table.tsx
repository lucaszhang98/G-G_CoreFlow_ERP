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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatDateDisplay } from "@/lib/utils"

interface OrderDetailItem {
  id: bigint | string
  detail_name: string
  sku: string
  description: string | null
  stock_quantity: number | null
  volume: number | string | null
  status: string | null
  fba: string | null
  detail_id: bigint | string | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: bigint | string | number | null
  updated_by: bigint | string | number | null
}

interface OrderDetail {
  id: bigint | string
  order_id: bigint | string | null
  detail_id: bigint | string | null
  quantity: number
  volume: number | string | null
  container_volume: number | string | null
  estimated_pallets: number | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: bigint | string | number | null
  updated_by: bigint | string | number | null
  order_detail_item_order_detail_item_detail_idToorder_detail: OrderDetailItem[]
}

interface OrderDetailTableProps {
  orderDetails: OrderDetail[]
}

export function OrderDetailTable({ orderDetails }: OrderDetailTableProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' 
      ? parseFloat(value) 
      : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  if (!orderDetails || orderDetails.length === 0) {
    return <p className="text-muted-foreground text-center py-8">暂无仓点明细</p>
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>仓点ID</TableHead>
            <TableHead>订单ID</TableHead>
            <TableHead>明细ID</TableHead>
            <TableHead>数量</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>货柜体积</TableHead>
            <TableHead>预估托盘数</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead>创建人ID</TableHead>
            <TableHead>更新人ID</TableHead>
            <TableHead>关联产品</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderDetails.map((detail) => {
            const rowId = detail.id.toString()
            const isExpanded = expandedRows.has(rowId)
            
            // 获取关联的SKU明细（一个仓点可以有多个SKU）
            // order_detail_item_order_detail_item_detail_idToorder_detail 是一个数组
            const relatedItems = detail.order_detail_item_order_detail_item_detail_idToorder_detail || []
            const itemsToShow = relatedItems

            return (
              <React.Fragment key={rowId}>
                {/* 主行：仓点明细 */}
                <TableRow>
                  <TableCell>
                    {itemsToShow.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleRow(rowId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <div className="w-6" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{detail.id.toString()}</TableCell>
                  <TableCell>{detail.order_id ? detail.order_id.toString() : "-"}</TableCell>
                  <TableCell>{detail.detail_id ? detail.detail_id.toString() : "-"}</TableCell>
                  <TableCell>{detail.quantity}</TableCell>
                  <TableCell>{formatNumber(detail.volume)}</TableCell>
                  <TableCell>{formatNumber(detail.container_volume)}</TableCell>
                  <TableCell>{detail.estimated_pallets || "-"}</TableCell>
                  <TableCell>{detail.created_at ? new Date(detail.created_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                  <TableCell>{detail.updated_at ? new Date(detail.updated_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                  <TableCell>{detail.created_by ? detail.created_by.toString() : "-"}</TableCell>
                  <TableCell>{detail.updated_by ? detail.updated_by.toString() : "-"}</TableCell>
                  <TableCell>
                    {itemsToShow.length > 0 ? (
                      <Badge variant="outline">{itemsToShow.length} 个SKU</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>

                {/* 展开的子行：SKU明细 */}
                {isExpanded && itemsToShow.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="p-0">
                      <div className="bg-muted/30 p-4">
                        <div className="mb-2 text-sm font-medium text-muted-foreground">
                          SKU明细 ({itemsToShow.length} 项)
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-muted">
                              <TableHead>SKU ID</TableHead>
                              <TableHead>SKU代码</TableHead>
                              <TableHead>SKU名称</TableHead>
                              <TableHead>描述</TableHead>
                              <TableHead>库存数量</TableHead>
                              <TableHead>体积</TableHead>
                              <TableHead>状态</TableHead>
                              <TableHead>FBA</TableHead>
                              <TableHead>明细ID</TableHead>
                              <TableHead>创建时间</TableHead>
                              <TableHead>更新时间</TableHead>
                              <TableHead>创建人ID</TableHead>
                              <TableHead>更新人ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itemsToShow.map((item) => (
                              <TableRow key={item.id.toString()} className="border-muted">
                                <TableCell className="font-medium">{item.id.toString()}</TableCell>
                                <TableCell className="font-medium">{item.detail_name}</TableCell>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>{item.description || "-"}</TableCell>
                                <TableCell>{formatNumber(item.stock_quantity)}</TableCell>
                                <TableCell>{formatNumber(item.volume)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                    {item.status || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.fba || "-"}</TableCell>
                                <TableCell>{item.detail_id ? item.detail_id.toString() : "-"}</TableCell>
                                <TableCell>{item.created_at ? formatDateDisplay(item.created_at) : "-"}</TableCell>
                                <TableCell>{item.updated_at ? formatDateDisplay(item.updated_at) : "-"}</TableCell>
                                <TableCell>{item.created_by ? item.created_by.toString() : "-"}</TableCell>
                                <TableCell>{item.updated_by ? item.updated_by.toString() : "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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

