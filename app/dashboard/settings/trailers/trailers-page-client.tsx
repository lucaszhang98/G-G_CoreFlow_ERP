"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { trailerConfig } from "@/lib/crud/configs/trailers"
import { TrailerImportDialog } from "./trailer-import-dialog"

export function TrailersPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleImportSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <>
      <EntityTable 
        config={trailerConfig}
        importConfig={{
          enabled: true,
          onImport: () => setImportDialogOpen(true)
        }}
        key={refreshTrigger}
      />
      
      <TrailerImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}
