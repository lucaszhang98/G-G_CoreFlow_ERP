"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateDriverImportTemplate, downloadDriverExcelFile } from "@/lib/utils/driver-excel-template"

interface DriverImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DriverImportDialog({ open, onOpenChange, onSuccess }: DriverImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="司机批量导入"
      description="支持批量导入司机信息。请先下载模板，填写数据后上传。"
      requiredFields="司机代码、驾驶证号、车牌号"
      apiEndpoint="/api/drivers/import"
      templateFilename="司机导入模板"
      generateTemplate={generateDriverImportTemplate}
      downloadTemplate={downloadDriverExcelFile}
    />
  )
}

