"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { EntityTable } from "@/components/crud/entity-table"
import { directDeliveryBillConfig } from "@/lib/crud/configs/invoices"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function DirectDeliveryBillTable() {
  const router = useRouter()

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
    <EntityTable
      config={directDeliveryBillConfig}
      initialFilterValues={{ invoice_type: "direct_delivery" }}
      customActions={customActions}
      customToolbarButtons={
        <Button asChild variant="default" size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Link href="/dashboard/finance/bills/direct-delivery/new">
            <Plus className="mr-2 h-5 w-5" />
            新建直送账单
          </Link>
        </Button>
      }
    />
  )
}
