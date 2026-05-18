'use client'

import { Button } from '@/components/ui/button'
import { FileStack } from 'lucide-react'
import { toast } from 'sonner'

type ReceivableRow = {
  invoice_id?: string | number | bigint | null
  invoices?: { invoice_id?: string | number | bigint | null } | null
}

function rowToInvoiceId(row: ReceivableRow): string | null {
  const direct = row.invoice_id ?? row.invoices?.invoice_id
  if (direct == null || direct === '') return null
  return typeof direct === 'bigint' ? direct.toString() : String(direct)
}

function openBatchInvoicePdf(invoiceIds: string[], noLogo: boolean) {
  const idsParam = invoiceIds.join(',')
  const noLogoQs = noLogo ? '&noLogo=1' : ''
  window.open(
    `/api/finance/invoices/batch-print/pdf?ids=${encodeURIComponent(idsParam)}${noLogoQs}`,
    '_blank',
    'noopener,noreferrer'
  )
}

/** 与出库「批量生成 BOL」一致：GET ?ids= + 新标签页打开合并 PDF */
export function ReceivablesBatchInvoicePdf({
  selectedRows,
}: {
  selectedRows: ReceivableRow[]
}) {
  const handleClick = (noLogo: boolean) => {
    const invoiceIds = [
      ...new Set(
        selectedRows.map(rowToInvoiceId).filter((id): id is string => Boolean(id))
      ),
    ]
    if (invoiceIds.length === 0) {
      toast.error('所选记录没有关联发票，无法生成')
      return
    }
    if (invoiceIds.length > 40) {
      toast.error('单次最多选择 40 条（对应 40 张发票）')
      return
    }

    openBatchInvoicePdf(invoiceIds, noLogo)
    toast.success(
      noLogo
        ? `已打开合并发票 PDF（无 logo，${invoiceIds.length} 张）`
        : `已打开合并发票 PDF（${invoiceIds.length} 张）`
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
        生成发票单据
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => handleClick(true)}
        className="min-w-[120px]"
      >
        <FileStack className="mr-2 h-4 w-4" />
        生成发票单据（无logo）
      </Button>
    </>
  )
}
