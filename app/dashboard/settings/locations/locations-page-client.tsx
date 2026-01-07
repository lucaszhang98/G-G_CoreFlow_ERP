"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { locationConfig } from "@/lib/crud/configs/locations"
import { LocationImportDialog } from "./location-import-dialog"

export function LocationsPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleImportSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <>
      <EntityTable 
        config={locationConfig}
        importConfig={{
          enabled: true,
          onImport: () => setImportDialogOpen(true)
        }}
        refreshKey={refreshTrigger}
      />
      
      <LocationImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}
