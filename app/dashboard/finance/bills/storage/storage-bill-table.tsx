"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { storageBillConfig } from "@/lib/crud/configs/invoices"
import { BillsBatchInvoicePdf } from "@/components/finance/bills-batch-invoice-pdf"

export function StorageBillTable() {
  const router = useRouter()
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])

  const customActions = React.useMemo(
    () => ({
      onView: (row: { invoice_id?: string | number }) => {
        const id = row.invoice_id != null ? String(row.invoice_id) : null
        if (id) router.push(`/dashboard/finance/bills/storage/${id}`)
      },
    }),
    [router]
  )

  return (
    <EntityTable
      config={storageBillConfig}
      initialFilterValues={{ invoice_type: "storage" }}
      customActions={customActions}
      onRowSelectionChange={setSelectedRows}
      customBatchActions={<BillsBatchInvoicePdf selectedRows={selectedRows} />}
    />
  )
}
