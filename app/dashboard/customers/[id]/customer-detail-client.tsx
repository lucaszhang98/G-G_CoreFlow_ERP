"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustomerForm } from "../customer-form"

interface Customer {
  id: string
  code: string
  name: string
  company_name?: string | null
  status?: string | null
  credit_limit?: string | null
  contact?: {
    name: string
    phone?: string | null
    email?: string | null
    address_line1?: string | null
    address_line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
}

interface CustomerDetailClientProps {
  customer: Customer
}

export function CustomerDetailClient({ customer }: CustomerDetailClientProps) {
  const router = useRouter()
  const [openDialog, setOpenDialog] = React.useState(false)

  // 转换数据格式以匹配 CustomerForm 的接口
  const customerData = {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    company_name: customer.company_name,
    status: customer.status as "active" | "inactive",
    credit_limit: customer.credit_limit,
    contact: customer.contact,
  }

  const handleFormSuccess = () => {
    setOpenDialog(false)
    router.refresh() // 刷新页面以显示更新后的数据
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpenDialog(true)}>
        <Edit className="mr-2 h-4 w-4" />
        编辑
      </Button>

      {/* 编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
            <DialogDescription>
              修改客户信息
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            customer={customerData}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setOpenDialog(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}



