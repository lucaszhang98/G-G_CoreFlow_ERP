"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function OutboundPrintLoadingSheetButton({ appointmentId }: { appointmentId: string }) {
  const handlePrint = () => {
    window.open(
      `/api/wms/outbound-shipments/${appointmentId}/print/loading-sheet`,
      '_blank'
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      className="flex items-center gap-2"
    >
      <Printer className="h-4 w-4" />
      打印装车单
    </Button>
  )
}
