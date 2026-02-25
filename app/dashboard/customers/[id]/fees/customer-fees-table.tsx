"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { feeConfig } from "@/lib/crud/configs/fees"

interface CustomerFeesTableProps {
  customerId: string
}

export function CustomerFeesTable({ customerId }: CustomerFeesTableProps) {
  const config = React.useMemo(
    () => ({
      ...feeConfig,
      apiPath: `/api/finance/fees/by-customer/${customerId}`,
      permissions: {
        ...feeConfig.permissions,
        create: [], // 客户费用表仅查看/编辑已有费用，不在此页新建
      },
    }),
    [customerId]
  )

  return (
    <EntityTable
      config={config}
      importConfig={{ enabled: false }}
    />
  )
}
