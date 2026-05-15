"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

type Props = {
  feeId: string
}

export function FeeInvoiceLinesExportCard({ feeId }: Props) {
  const [exporting, setExporting] = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/finance/fees/${feeId}/invoice-lines-export`
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j.error === "string" ? j.error : "导出失败")
      }
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition")
      let filename = `费用-${feeId}-核销明细.xlsx`
      const m = cd?.match(/filename\*=UTF-8''(.+)/i)
      if (m?.[1]) {
        try {
          filename = decodeURIComponent(m[1])
        } catch {
          /* keep default */
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("已开始下载")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>核销明细</CardTitle>
        <CardDescription>
          本费用在各类账单明细中的引用记录（按费用 ID 或行上费用编码/名称与主数据一致匹配）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              导出中…
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              导出 Excel
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
