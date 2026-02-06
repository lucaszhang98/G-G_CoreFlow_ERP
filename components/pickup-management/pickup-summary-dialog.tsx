"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface PickupSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRecords: any[]
}

export function PickupSummaryDialog({
  open,
  onOpenChange,
  selectedRecords,
}: PickupSummaryDialogProps) {
  const [copied, setCopied] = React.useState(false)

  // 格式化日期时间（直接字符串处理，不做任何转换）
  const formatDateTime = (date: any) => {
    if (!date) return ''
    try {
      const str = String(date)
      // 直接截取前16个字符：2026-01-08T14:30 -> 2026-01-08 14:30
      return str.slice(0, 16).replace('T', ' ')
    } catch {
      return String(date)
    }
  }

  // 格式化日期（直接字符串处理，不做任何转换）
  const formatDate = (date: any) => {
    if (!date) return ''
    try {
      const str = String(date)
      // 直接截取前10个字符：2026-01-08
      return str.slice(0, 10)
    } catch {
      return String(date)
    }
  }

  // 生成单个记录的汇总文本
  const generateSummaryText = (record: any) => {
    const lines: string[] = []
    
    // 码头/查验站
    const portLocation = record.port_location?.name || record.port_location || ''
    if (portLocation) {
      lines.push(`码头/查验站：${portLocation}`)
    }
    
    // 码头位置
    if (record.port_text) {
      lines.push(`码头位置：${record.port_text}`)
    }
    
    // 船司
    if (record.shipping_line) {
      lines.push(`船司：${record.shipping_line}`)
    }
    
    // 柜号
    if (record.container_number) {
      lines.push(`柜号：${record.container_number}`)
    }
    
    // MBL
    if (record.mbl) {
      lines.push(`MBL：${record.mbl}`)
    }
    
    // 柜子尺寸
    if (record.container_type) {
      lines.push(`柜子尺寸：${record.container_type}`)
    }
    
    // 提柜日期
    if (record.pickup_date) {
      lines.push(`提柜日期：${formatDateTime(record.pickup_date)}`)
    }
    
    // LFD
    if (record.lfd_date) {
      lines.push(`LFD：${formatDate(record.lfd_date)}`)
    }
    
    // 司机
    const driver = record.driver_name || ''
    if (driver) {
      lines.push(`司机：${driver}`)
    }
    
    // 送货地
    if (record.delivery_location) {
      lines.push(`送货地：${record.delivery_location}`)
    }
    
    return lines.join('\n')
  }

  // 生成所有记录的汇总文本
  const generateAllSummaryText = () => {
    if (selectedRecords.length === 0) return ''
    
    return selectedRecords
      .map((record, index) => {
        const summary = generateSummaryText(record)
        // 如果是多个记录，添加标记
        if (selectedRecords.length > 1) {
          return `【第 ${index + 1} 条】\n${summary}`
        }
        return summary
      })
      .join('\n')
  }

  const summaryText = generateAllSummaryText()

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      toast.success('已复制到剪贴板')
      
      // 2秒后重置状态
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      toast.error('复制失败，请手动选择复制')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>提柜信息汇总</DialogTitle>
          <DialogDescription>
            已选中 {selectedRecords.length} 条记录，点击复制按钮可快速复制全部信息
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto bg-muted/30 rounded-lg p-4 my-4">
          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {summaryText || '暂无数据'}
          </pre>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!summaryText}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                复制全部
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

