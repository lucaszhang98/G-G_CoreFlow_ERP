"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { feeConfig } from "@/lib/crud/configs/fees"
import { FeeImportDialog } from "./fee-import-dialog"

export function FeesPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleImportSuccess = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <>
      <EntityTable
        config={feeConfig}
        importConfig={{
          enabled: true,
          onImport: () => setImportDialogOpen(true),
        }}
        refreshKey={refreshTrigger}
      />
      <FeeImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}
