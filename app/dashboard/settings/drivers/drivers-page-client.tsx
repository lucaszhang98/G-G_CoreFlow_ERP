"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { driverConfig } from "@/lib/crud/configs/drivers"
import { DriverImportDialog } from "./driver-import-dialog"

export function DriversPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleImportSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <>
      <EntityTable 
        config={driverConfig}
        importConfig={{
          enabled: true,
          onImport: () => setImportDialogOpen(true)
        }}
        key={refreshTrigger}
      />
      
      <DriverImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}

