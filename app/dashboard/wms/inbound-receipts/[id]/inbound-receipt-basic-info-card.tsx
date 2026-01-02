"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { FileText, Tag } from "lucide-react"
import { toast } from "sonner"

interface InboundReceiptBasicInfoCardProps {
  inboundReceipt: any
  formatDate: (date: Date | string | null) => string
  formatNumber: (value: number | null | string | any) => string
  orderDetails?: any[]
  inboundReceiptId?: string
}

export function InboundReceiptBasicInfoCard({
  inboundReceipt,
  formatDate,
  formatNumber,
  orderDetails = [],
  inboundReceiptId,
}: InboundReceiptBasicInfoCardProps) {
  const [isGeneratingUnloadSheet, setIsGeneratingUnloadSheet] = React.useState(false)
  const [isGeneratingLabels, setIsGeneratingLabels] = React.useState(false)

  // 生成拆柜单据
  const handleGenerateUnloadSheet = async () => {
    if (!inboundReceiptId) {
      toast.error('缺少入库管理ID')
      return
    }

    if (!orderDetails || orderDetails.length === 0) {
      toast.error('没有订单明细数据，无法生成拆柜单据')
      return
    }

    setIsGeneratingUnloadSheet(true)
    try {
      const containerNumber = inboundReceipt.container_number || ''
      const unloadedBy = inboundReceipt.unloaded_by || ''
      const receivedBy = inboundReceipt.received_by || ''
      const unloadDate = inboundReceipt.planned_unload_at || ''

      // 构建查询参数
      const params = new URLSearchParams({
        containerNumber,
        unloadedBy,
        receivedBy,
        unloadDate: unloadDate ? formatDate(unloadDate) : '',
        orderDetails: JSON.stringify(orderDetails.map(detail => ({
          delivery_nature: detail.delivery_nature,
          delivery_location: detail.delivery_location,
          quantity: detail.quantity,
          notes: detail.notes,
        }))),
      })

      const url = `/api/wms/inbound-receipts/${inboundReceiptId}/print/unload-sheet?${params.toString()}`
      
      const response = await fetch(url)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '生成拆柜单据失败')
      }

      // 获取 PDF blob
      const blob = await response.blob()
      const pdfUrl = window.URL.createObjectURL(blob)
      
      // 创建临时链接并下载
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `${containerNumber}-拆柜单据.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(pdfUrl)

      toast.success('拆柜单据生成成功')
    } catch (error: any) {
      console.error('生成拆柜单据失败:', error)
      toast.error(error.message || '生成拆柜单据失败')
    } finally {
      setIsGeneratingUnloadSheet(false)
    }
  }

  // 生成 Label
  const handleGenerateLabels = async () => {
    if (!inboundReceiptId) {
      toast.error('缺少入库管理ID')
      return
    }

    if (!orderDetails || orderDetails.length === 0) {
      toast.error('没有订单明细数据，无法生成 Label')
      return
    }

    setIsGeneratingLabels(true)
    try {
      const containerNumber = inboundReceipt.container_number || ''
      const customerCode = inboundReceipt.customer_name || ''
      const plannedUnloadDate = inboundReceipt.planned_unload_at || ''

      // 构建查询参数
      const params = new URLSearchParams({
        containerNumber,
        customerCode,
        plannedUnloadDate: plannedUnloadDate ? formatDate(plannedUnloadDate) : '',
        orderDetails: JSON.stringify(orderDetails.map(detail => ({
          id: detail.id,
          order_detail_id: detail.id,
          delivery_location: detail.delivery_location,
          deliveryLocation: detail.delivery_location,
          estimated_pallets: detail.estimated_pallets,
          estimatedPallets: detail.estimated_pallets,
          delivery_nature: detail.delivery_nature,
          deliveryNature: detail.delivery_nature,
        }))),
      })

      const url = `/api/wms/inbound-receipts/${inboundReceiptId}/print/labels?${params.toString()}`
      
      const response = await fetch(url)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '生成 Label 失败')
      }

      // 获取 PDF blob
      const blob = await response.blob()
      const pdfUrl = window.URL.createObjectURL(blob)
      
      // 创建临时链接并下载
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `${containerNumber}-label.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(pdfUrl)

      toast.success('Label 生成成功')
    } catch (error: any) {
      console.error('生成 Label 失败:', error)
      toast.error(error.message || '生成 Label 失败')
    } finally {
      setIsGeneratingLabels(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{inboundReceipt.container_number || '入库管理'}</CardTitle>
            <CardDescription className="mt-2">
              入库管理ID: {inboundReceipt.inbound_receipt_id}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateUnloadSheet}
              disabled={isGeneratingUnloadSheet || !orderDetails || orderDetails.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {isGeneratingUnloadSheet ? '生成中...' : '生成单据'}
            </Button>
            <Button
              onClick={handleGenerateLabels}
              disabled={isGeneratingLabels || !orderDetails || orderDetails.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Tag className="h-4 w-4" />
              {isGeneratingLabels ? '生成中...' : '生成 Label'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 客户信息 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">客户名称</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.customer_name || "-"}
            </p>
          </div>

          {/* 拆柜人员 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">拆柜人员</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.unloaded_by || "-"}
            </p>
          </div>

          {/* 柜号 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">柜号</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.container_number || "-"}
            </p>
          </div>

          {/* 入库人员 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">入库人员</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.received_by || "-"}
            </p>
          </div>

          {/* 拆柜日期 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">拆柜日期</h4>
            <p className="text-sm font-semibold">
              {formatDate(inboundReceipt.planned_unload_at)}
            </p>
          </div>

          {/* 整柜体积 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">整柜体积</h4>
            <p className="text-sm font-semibold">
              {inboundReceipt.total_container_volume !== null && inboundReceipt.total_container_volume !== undefined 
                ? Number(inboundReceipt.total_container_volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

