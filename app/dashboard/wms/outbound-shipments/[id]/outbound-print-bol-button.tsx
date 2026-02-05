"use client"

import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

export function OutboundPrintBOLButton({ appointmentId }: { appointmentId: string }) {
  const handlePrint = () => {
    window.open(
      `/api/wms/outbound-shipments/${appointmentId}/print/bol`,
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
      <FileText className="h-4 w-4" />
      生成 BOL
    </Button>
  )
}
