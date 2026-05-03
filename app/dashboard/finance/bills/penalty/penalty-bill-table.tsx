"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { penaltyBillConfig } from "@/lib/crud/configs/invoices"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { NewPenaltyBillDialog } from "./new-penalty-bill-dialog"

export function PenaltyBillTable() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const customActions = React.useMemo(
    () => ({
      onView: (row: { invoice_id?: string | number }) => {
        const id = row.invoice_id != null ? String(row.invoice_id) : null
        if (id) router.push(`/dashboard/finance/bills/penalty/${id}`)
      },
    }),
    [router]
  )

  return (
    <>
      <EntityTable
        config={penaltyBillConfig}
        initialFilterValues={{ invoice_type: "penalty" }}
        customActions={customActions}
        refreshKey={refreshKey}
        customToolbarButtons={
          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            新建负数账单
          </Button>
        }
      />
      <NewPenaltyBillDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  )
}
