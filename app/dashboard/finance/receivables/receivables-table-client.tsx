'use client'

import { EntityTable } from '@/components/crud/entity-table'
import { receivableConfig } from '@/lib/crud/configs/receivables'
import { ReceivablesBatchInvoicePdf } from '@/components/finance/receivables-batch-invoice-pdf'
import { ReceivablesStatementExportButton } from '@/components/finance/receivables-statement-export-button'

export function ReceivablesTableClient() {
  return (
    <EntityTable
      config={receivableConfig}
      customActions={{ onView: null }}
      customToolbarButtons={<ReceivablesStatementExportButton />}
      customBatchActions={({ selectedRows }) => (
        <ReceivablesBatchInvoicePdf selectedRows={selectedRows} />
      )}
    />
  )
}
