"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { customerConfig } from "@/lib/crud/configs/customers"
import { CustomerForm } from "./customer-form"
import { CustomerImportDialog } from "./customer-import-dialog"

export function CustomersPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleImportSuccess = () => {
    // 导入成功后刷新列表
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <>
      <EntityTable 
        config={customerConfig} 
        FormComponent={CustomerForm}
        importConfig={{
          enabled: true,
          onImport: () => setImportDialogOpen(true)
        }}
        refreshKey={refreshTrigger}
      />
      
      <CustomerImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  )
}
