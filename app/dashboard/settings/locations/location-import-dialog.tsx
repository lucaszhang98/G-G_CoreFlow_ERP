"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateLocationImportTemplate, downloadLocationExcelFile } from "@/lib/utils/location-excel-template"

interface LocationImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LocationImportDialog({ open, onOpenChange, onSuccess }: LocationImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="位置批量导入"
      description="支持批量导入位置信息。请先下载模板，填写数据后上传。"
      requiredFields="位置代码、位置名称、位置类型"
      apiEndpoint="/api/locations/import"
      templateFilename="位置导入模板"
      generateTemplate={generateLocationImportTemplate}
      downloadTemplate={downloadLocationExcelFile}
    />
  )
}
