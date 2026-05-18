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

function openBatchInvoicePdf(invoiceIds: string[], noLogo: boolean) {
  const idsParam = invoiceIds.join(",")
  const noLogoQs = noLogo ? "&noLogo=1" : ""
  window.open(
    `/api/finance/invoices/batch-print/pdf?ids=${encodeURIComponent(idsParam)}${noLogoQs}`,
    "_blank",
    "noopener,noreferrer"
  )
}

/** 四类账单列表：勾选后合并打开 PDF（GET /api/finance/invoices/batch-print/pdf） */
export function BillsBatchInvoicePdf({ selectedRows }: { selectedRows: BillRow[] }) {
  const handleClick = (noLogo: boolean) => {
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

    openBatchInvoicePdf(invoiceIds, noLogo)
    toast.success(
      noLogo
        ? `已打开合并账单 PDF（无 logo，${invoiceIds.length} 张）`
        : `已打开合并账单 PDF（${invoiceIds.length} 张）`
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => handleClick(false)}
        className="min-w-[120px]"
      >
        <FileStack className="mr-2 h-4 w-4" />
        生成账单 PDF
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => handleClick(true)}
        className="min-w-[120px]"
      >
        <FileStack className="mr-2 h-4 w-4" />
        生成账单 PDF（无logo）
      </Button>
    </>
  )
}
