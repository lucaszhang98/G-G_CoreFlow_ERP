'use client'

import { Button } from '@/components/ui/button'
import { FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

/** 使用当前页 URL 上的筛选参数（与列表请求一致），导出 STATEMENT 版式 Excel；余额为 0 的行不导出 */
export function ReceivablesStatementExportButton() {
  const handleExport = () => {
    const qs = typeof window !== 'undefined' ? window.location.search : ''
    const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs)
    params.delete('page')
    params.delete('limit')
    const tail = params.toString()
    const url = tail
      ? `/api/finance/receivables/export-statement?${tail}`
      : '/api/finance/receivables/export-statement'
    window.open(url, '_blank', 'noopener,noreferrer')
    toast.success('正在下载对账单（已排除余额为 0 的行）')
  }

  return (
    <Button type="button" variant="outline" size="sm" className="min-w-[120px]" onClick={handleExport}>
      <FileSpreadsheet className="mr-2 h-4 w-4" />
      导出对账单 Excel
    </Button>
  )
}
