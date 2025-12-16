"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateCustomerImportTemplate, downloadCustomerExcelFile } from "@/lib/utils/customer-excel-template"

interface CustomerImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="客户批量导入"
      description="支持批量导入客户信息。请先下载模板，填写数据后上传。"
      requiredFields="客户代码、客户名称"
      apiEndpoint="/api/customers/import"
      templateFilename="客户导入模板"
      generateTemplate={generateCustomerImportTemplate}
      downloadTemplate={downloadCustomerExcelFile}
    />
  )
}
