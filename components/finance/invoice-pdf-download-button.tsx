'use client'

import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'

/** 与出库「生成 BOL」一致：新标签页 inline 打开 PDF（不触发自动下载） */
export function InvoicePdfDownloadButton({ invoiceId }: { invoiceId: string }) {
  const handleClick = () => {
    if (!invoiceId) return
    window.open(
      `/api/finance/invoices/${invoiceId}/print/pdf`,
      '_blank',
      'noopener,noreferrer'
    )
    toast.success('已打开发票 PDF')
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      <FileText className="h-4 w-4 mr-1.5" />
      生成发票 PDF
    </Button>
  )
}
