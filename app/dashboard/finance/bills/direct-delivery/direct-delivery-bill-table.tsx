"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { directDeliveryBillConfig } from "@/lib/crud/configs/invoices"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { NewDirectDeliveryDialog } from "./new-direct-delivery-dialog"
import { BillsBatchInvoicePdf } from "@/components/finance/bills-batch-invoice-pdf"

export function DirectDeliveryBillTable() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [selectedRows, setSelectedRows] = React.useState<any[]>([])

  const customActions = React.useMemo(
    () => ({
      onView: (row: { invoice_id?: string | number }) => {
        const id = row.invoice_id != null ? String(row.invoice_id) : null
        if (id) router.push(`/dashboard/finance/bills/direct-delivery/${id}`)
      },
    }),
    [router]
  )

  return (
    <>
      <EntityTable
        config={directDeliveryBillConfig}
        initialFilterValues={{ invoice_type: "direct_delivery" }}
        customActions={customActions}
        refreshKey={refreshKey}
        onRowSelectionChange={setSelectedRows}
        customBatchActions={<BillsBatchInvoicePdf selectedRows={selectedRows} />}
        customToolbarButtons={
          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            新建直送账单
          </Button>
        }
      />
      <NewDirectDeliveryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  )
}
