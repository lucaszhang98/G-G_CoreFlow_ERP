"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { InboundReceiptBasicInfoCard } from "./inbound-receipt-basic-info-card"
import { InboundReceiptDetailsTable } from "./inbound-receipt-details-table"

interface InboundReceiptDetailPageClientProps {
  inboundReceipt: any
  orderDetails: any[]
  inventoryLots: any[]
  deliveryAppointments: any[]
  inboundReceiptId: string
  customerCode?: string // 客户代码
}

export function InboundReceiptDetailPageClient({
  inboundReceipt,
  orderDetails,
  inventoryLots,
  deliveryAppointments,
  inboundReceiptId,
  customerCode,
}: InboundReceiptDetailPageClientProps) {
  // 格式化日期（不包含年份，节省空间）
  // 修复时区问题：如果是日期字符串（YYYY-MM-DD），直接解析，避免时区转换
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-"
    
    // 如果是字符串格式的日期（YYYY-MM-DD），直接解析年月日，避免时区问题
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      const dateStr = date.split('T')[0] // 只取日期部分，忽略时间
      const [year, month, day] = dateStr.split('-').map(Number)
      return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    
    // 如果是 Date 对象，使用本地时间
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return "-"
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  const formatNumber = (value: number | null | string | any) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' 
      ? parseFloat(value) 
      : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const handlePrintLabels = () => {
    // 从已有的 orderDetails 数据生成 Label
    // 准备查询参数
    const containerNumber = inboundReceipt.container_number || ''
    const plannedUnloadDate = inboundReceipt.planned_unload_at 
      ? (typeof inboundReceipt.planned_unload_at === 'string' 
          ? inboundReceipt.planned_unload_at.split('T')[0]
          : new Date(inboundReceipt.planned_unload_at).toISOString().split('T')[0])
      : ''

    if (!containerNumber || !plannedUnloadDate) {
      alert('缺少必要信息：柜号或预计拆柜日期')
      return
    }

    if (!customerCode) {
      alert('缺少客户代码')
      return
    }

    if (!orderDetails || orderDetails.length === 0) {
      alert('没有订单明细数据')
      return
    }

    // 构建查询参数
    const params = new URLSearchParams({
      orderDetails: JSON.stringify(orderDetails),
      containerNumber,
      customerCode,
      plannedUnloadDate,
    })

    // 打开新窗口生成 Label PDF
    window.open(`/api/wms/inbound-receipts/${inboundReceiptId}/print/labels?${params.toString()}`, '_blank')
  }

  const handlePrintUnloadSheet = () => {
    // 从已有的数据生成拆柜单据
    const containerNumber = inboundReceipt.container_number || ''
    const unloadedBy = inboundReceipt.unloaded_by || ''
    const receivedBy = inboundReceipt.received_by || ''
    // 修复时区问题：如果 planned_unload_at 是日期字符串，直接使用，避免时区转换
    let unloadDate = ''
    if (inboundReceipt.planned_unload_at) {
      if (typeof inboundReceipt.planned_unload_at === 'string') {
        // 如果是字符串格式的日期（YYYY-MM-DD），直接使用
        unloadDate = inboundReceipt.planned_unload_at.split('T')[0]
      } else {
        // 如果是 Date 对象，转换为本地日期字符串（避免时区问题）
        const d = new Date(inboundReceipt.planned_unload_at)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        unloadDate = `${year}-${month}-${day}`
      }
    }

    if (!containerNumber) {
      alert('缺少必要信息：柜号')
      return
    }

    if (!orderDetails || orderDetails.length === 0) {
      alert('没有订单明细数据')
      return
    }

    // 构建查询参数
    const params = new URLSearchParams({
      containerNumber,
      orderDetails: JSON.stringify(orderDetails),
    })

    // 可选参数
    if (unloadedBy) {
      params.append('unloadedBy', unloadedBy)
    }
    if (receivedBy) {
      params.append('receivedBy', receivedBy)
    }
    if (unloadDate) {
      params.append('unloadDate', unloadDate)
    }

    // 打开新窗口生成拆柜单据 PDF
    window.open(`/api/wms/inbound-receipts/${inboundReceiptId}/print/unload-sheet?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* 操作按钮区域 */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handlePrintUnloadSheet}
          className="flex items-center gap-2"
          variant="outline"
        >
          <Printer className="h-4 w-4" />
          生成单据
        </Button>
        <Button
          onClick={handlePrintLabels}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          生成 Label
        </Button>
      </div>

      {/* 入库管理基本信息卡片 */}
      <InboundReceiptBasicInfoCard
        inboundReceipt={inboundReceipt}
        formatDate={formatDate}
        formatNumber={formatNumber}
      />

      {/* 仓点明细表格 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>仓点明细</CardTitle>
          <CardDescription>该柜号的所有仓点信息</CardDescription>
        </CardHeader>
        <CardContent>
          <InboundReceiptDetailsTable
            inboundReceiptId={inboundReceiptId}
            orderDetails={orderDetails}
            inventoryLots={inventoryLots}
            deliveryAppointments={deliveryAppointments}
            warehouseId={inboundReceipt?.warehouse_id?.toString() || inboundReceipt?.warehouses?.warehouse_id?.toString() || ''}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}

