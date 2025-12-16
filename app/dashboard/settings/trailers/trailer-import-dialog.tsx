"use client"

import * as React from "react"
import { BaseImportDialog } from "@/components/import/base-import-dialog"
import { generateTrailerImportTemplate, downloadTrailerExcelFile } from "@/lib/utils/trailer-excel-template"

interface TrailerImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TrailerImportDialog({ open, onOpenChange, onSuccess }: TrailerImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="货柜批量导入"
      description="支持批量导入货柜信息。请先下载模板，填写数据后上传。"
      requiredFields="货柜代码、货柜类型"
      apiEndpoint="/api/trailers/import"
      templateFilename="货柜导入模板"
      generateTemplate={generateTrailerImportTemplate}
      downloadTemplate={downloadTrailerExcelFile}
    />
  )
}
