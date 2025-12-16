"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateOrderImportTemplate, downloadExcelFile } from "@/lib/utils/excel-template"

interface OrderImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function OrderImportDialog({ open, onOpenChange, onSuccess }: OrderImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="订单批量导入"
      description="支持批量导入订单和订单明细。请先下载模板，填写数据后上传。"
      requiredFields="订单号、客户代码、订单日期、操作方式、ETA、MBL、DO、送仓地点、性质、货柜类型、数量、体积"
      apiEndpoint="/api/oms/orders/import"
      templateFilename="订单导入模板"
      templateDataEndpoint="/api/oms/orders/import/template"
      generateTemplate={generateOrderImportTemplate}
      downloadTemplate={downloadExcelFile}
    />
  )
}
