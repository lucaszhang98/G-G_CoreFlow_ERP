'use client'

import { EntityTable } from '@/components/crud/entity-table'
import { receivableConfig } from '@/lib/crud/configs/receivables'
import { ReceivablesBatchInvoicePdf } from '@/components/finance/receivables-batch-invoice-pdf'

export function ReceivablesTableClient() {
  return (
    <EntityTable
      config={receivableConfig}
      customActions={{ onView: null }}
      customBatchActions={({ selectedRows }) => (
        <ReceivablesBatchInvoicePdf selectedRows={selectedRows} />
      )}
    />
  )
}
