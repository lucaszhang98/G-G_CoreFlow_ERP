"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { deliveryManagementConfig } from "@/lib/crud/configs/delivery-management"

export function DeliveryManagementClient() {
  return (
    <EntityTable config={deliveryManagementConfig} />
  )
}
