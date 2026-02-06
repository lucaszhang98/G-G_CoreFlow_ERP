"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generatePickupManagementImportTemplate } from "@/lib/utils/pickup-management-excel-template"
import { downloadExcelFile } from "@/lib/utils/excel-template"

interface PickupImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function PickupImportDialog({ open, onOpenChange, onSuccess }: PickupImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="提柜管理批量导入"
      description="仅支持按柜号匹配系统中已有订单并更新，不会新建任何数据；柜号找不到对应订单时该行会报错。请先下载模板，填写柜号及需更新的字段后上传；码头/查验站、柜型、承运公司、现在位置请从下拉选择；司机请直接填写。"
      requiredFields="柜号（必填，用于匹配已有订单）"
      apiEndpoint="/api/tms/pickup-management/import"
      templateFilename="提柜管理批量导入模板"
      templateDataEndpoint="/api/tms/pickup-management/import/template"
      generateTemplate={generatePickupManagementImportTemplate}
      downloadTemplate={downloadExcelFile}
    />
  )
}
