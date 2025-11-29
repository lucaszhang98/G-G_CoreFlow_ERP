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
import { EntityConfig } from "@/lib/crud/types"

interface CustomerDetailClientProps {
  config: EntityConfig
  data: any
}

export function CustomerDetailClient({ config, data }: CustomerDetailClientProps) {
  const router = useRouter()
  const [openDialog, setOpenDialog] = React.useState(false)

  // 转换数据格式以匹配 CustomerForm 的接口
  // 处理 contact_roles 关联数据
  const contactData = data.contact_roles || data.contact
  const customerData = {
    id: String(data.id),
    code: data.code,
    name: data.name,
    company_name: data.company_name || null,
    status: data.status || "active",
    credit_limit: data.credit_limit ? String(data.credit_limit) : null,
    contact: contactData ? {
      name: contactData.name || "",
      phone: contactData.phone || null,
      email: contactData.email || null,
      address_line1: contactData.address_line1 || null,
      address_line2: contactData.address_line2 || null,
      city: contactData.city || null,
      state: contactData.state || null,
      postal_code: contactData.postal_code || null,
      country: contactData.country || null,
    } : null,
  }

  const handleFormSuccess = () => {
    setOpenDialog(false)
    router.refresh() // 刷新页面以显示更新后的数据
  }

  return (
    <>
      <Button 
        variant="outline" 
        size="icon"
        onClick={() => setOpenDialog(true)}
        title="编辑"
        className="h-8 w-8"
      >
        <Edit className="h-4 w-4" />
      </Button>

      {/* 编辑对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑{config.displayName}</DialogTitle>
            <DialogDescription>
              修改{config.displayName}信息
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



