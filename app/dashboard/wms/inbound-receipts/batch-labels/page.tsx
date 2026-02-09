'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText } from 'lucide-react'

function BatchLabelsContent() {
  const searchParams = useSearchParams()
  const idsParam = searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
  const count = ids.length

  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-6">
        <p className="text-muted-foreground">未指定 ids，请从入库管理列表勾选后点击「批量生成 Label」。</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-background">
      <div className="flex flex-col gap-6 p-4 pb-8 min-h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-5 w-5" />
          <span>共 {count} 个 Label（可滚动查看下方）</span>
        </div>
        <div className="flex flex-col gap-4">
          {ids.map((id, index) => (
            <div key={id} className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">#{index + 1} 入库单 ID: {id}</span>
              <iframe
                title={`Label ${id}`}
                src={`/api/wms/inbound-receipts/${id}/print/labels`}
                className="w-full border rounded-md bg-white shrink-0"
                style={{ minHeight: '75vh', height: '75vh' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 批量 Label：一个标签页内用多个 iframe 分别加载每条 PDF，选多少条就显示多少块，无需多步、不被拦截。
 */
export default function BatchLabelsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center p-6 text-muted-foreground">加载中...</div>}>
      <BatchLabelsContent />
    </Suspense>
  )
}
