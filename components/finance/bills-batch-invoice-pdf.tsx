"use client"

import { Button } from "@/components/ui/button"
import { FileStack } from "lucide-react"
import { toast } from "sonner"

type BillRow = {
  invoice_id?: string | number | bigint | null
}

function rowToInvoiceId(row: BillRow): string | null {
  const v = row.invoice_id
  if (v == null || v === "") return null
  return typeof v === "bigint" ? v.toString() : String(v)
}

/** 四类账单列表：勾选后合并打开 PDF（GET /api/finance/invoices/batch-print/pdf） */
export function BillsBatchInvoicePdf({ selectedRows }: { selectedRows: BillRow[] }) {
  const handleClick = () => {
    const invoiceIds = [
      ...new Set(
        selectedRows.map(rowToInvoiceId).filter((id): id is string => Boolean(id))
      ),
    ]
    if (invoiceIds.length === 0) {
      toast.error("请先勾选要生成 PDF 的账单")
      return
    }
    if (invoiceIds.length > 40) {
      toast.error("单次最多选择 40 条账单")
      return
    }

    const idsParam = invoiceIds.join(",")
    window.open(
      `/api/finance/invoices/batch-print/pdf?ids=${encodeURIComponent(idsParam)}`,
      "_blank",
      "noopener,noreferrer"
    )
    toast.success(`已打开合并账单 PDF（${invoiceIds.length} 张）`)
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleClick}
      className="min-w-[120px]"
    >
      <FileStack className="mr-2 h-4 w-4" />
      生成账单 PDF
    </Button>
  )
}
