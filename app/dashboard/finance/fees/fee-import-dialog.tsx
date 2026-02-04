"use client"

import { BaseImportDialog } from "@/components/import/base-import-dialog"
import {
  generateFeeImportTemplate,
  downloadFeeExcelFile,
} from "@/lib/utils/fee-excel-template"

interface FeeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function FeeImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: FeeImportDialogProps) {
  return (
    <BaseImportDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      title="费用批量导入"
      description="支持批量导入费用主数据。请先下载模板，填写数据后上传。"
      requiredFields="费用编码、费用名称、单价、归属范围（all 或 customers）"
      apiEndpoint="/api/finance/fees/import"
      templateFilename="费用导入模板"
      generateTemplate={generateFeeImportTemplate}
      downloadTemplate={downloadFeeExcelFile}
    />
  )
}
