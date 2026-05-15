"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EntityTable } from "@/components/crud/entity-table"
import { paymentConfig } from "@/lib/crud/configs/payments"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NewPaymentForm } from "@/components/finance/new-payment-form"

export function PaymentsPageClient() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [formMountKey, setFormMountKey] = React.useState(0)

  const openCreate = React.useCallback(() => {
    setFormMountKey((k) => k + 1)
    setCreateOpen(true)
  }, [])

  return (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建收款</DialogTitle>
            <DialogDescription>
              币种固定为 USD。保存后将进入该笔收款详情，可在详情中进行消账。
            </DialogDescription>
          </DialogHeader>
          {createOpen ? (
            <NewPaymentForm
              key={formMountKey}
              onCancel={() => setCreateOpen(false)}
              onCreated={(id) => {
                setCreateOpen(false)
                router.push(`/dashboard/finance/payments/${id}`)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <EntityTable
        config={paymentConfig}
        customActions={{
          onAdd: openCreate,
        }}
      />
    </>
  )
}
