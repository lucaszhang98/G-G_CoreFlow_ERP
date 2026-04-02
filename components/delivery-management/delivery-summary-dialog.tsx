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

interface DeliverySummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRecords: any[]
}

export function DeliverySummaryDialog({
  open,
  onOpenChange,
  selectedRecords,
}: DeliverySummaryDialogProps) {
  const [copied, setCopied] = React.useState(false)

  const formatDateTime = (date: unknown) => {
    if (!date) return ""
    try {
      const str = String(date)
      return str.slice(0, 16).replace("T", " ")
    } catch {
      return String(date)
    }
  }

  const generateSummaryText = (record: any) => {
    const lines: string[] = []
    if (record.container_number) {
      lines.push(`柜号：${record.container_number}`)
    }
    if (record.origin_location) {
      lines.push(`起始地：${record.origin_location}`)
    }
    if (record.destination_location) {
      lines.push(`目的地：${record.destination_location}`)
    }
    if (record.appointment_time) {
      lines.push(`预约时间：${formatDateTime(record.appointment_time)}`)
    }
    if (record.appointment_number) {
      lines.push(`预约号码：${record.appointment_number}`)
    }
    return lines.join("\n")
  }

  const generateAllSummaryText = () => {
    if (selectedRecords.length === 0) return ""
    return selectedRecords
      .map((record, index) => {
        const summary = generateSummaryText(record)
        if (selectedRecords.length > 1) {
          return `【第 ${index + 1} 条】\n${summary}`
        }
        return summary
      })
      .join("\n")
  }

  const summaryText = generateAllSummaryText()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      toast.success("已复制到剪贴板")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("复制失败，请手动选择复制")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>送仓信息汇总</DialogTitle>
          <DialogDescription>
            已选中 {selectedRecords.length} 条记录，点击复制按钮可快速复制全部信息
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/30 rounded-lg p-4 my-4">
          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {summaryText || "暂无数据"}
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button onClick={handleCopy} disabled={!summaryText} className="gap-2">
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
