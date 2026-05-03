"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { EntityTable } from "@/components/crud/entity-table"
import { feeConfig } from "@/lib/crud/configs/fees"
import { FeeImportDialog } from "./fee-import-dialog"
import { CloneDefaultFeesButton } from "./clone-default-fees-button"
import { BatchUpdateFeePriceDialog } from "./batch-update-fee-price-dialog"
import { SlidersHorizontal } from "lucide-react"

/** 与 EntityTable「批量导入」同款大号描边按钮 */
const BATCH_TOOLBAR_BTN =
  "group relative h-11 px-6 text-base font-medium border-2 border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm hover:shadow-md transition-all duration-200"

export function FeesPageClient() {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [batchPriceOpen, setBatchPriceOpen] = React.useState(false)
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
        customToolbarButtons={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={BATCH_TOOLBAR_BTN}
              onClick={() => setBatchPriceOpen(true)}
            >
              <SlidersHorizontal className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
              <span>批量调价</span>
            </Button>
            <CloneDefaultFeesButton onSuccess={() => setRefreshTrigger((k) => k + 1)} />
          </div>
        }
        refreshKey={refreshTrigger}
      />
      <FeeImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
      <BatchUpdateFeePriceDialog
        open={batchPriceOpen}
        onOpenChange={setBatchPriceOpen}
        onSuccess={() => setRefreshTrigger((k) => k + 1)}
      />
    </>
  )
}
