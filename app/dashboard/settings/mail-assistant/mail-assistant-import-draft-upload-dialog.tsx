"use client"

import * as React from "react"
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type MailAssistantImportDraftUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  containerNumber: string | null
  onSuccess?: () => void
}

export function MailAssistantImportDraftUploadDialog({
  open,
  onOpenChange,
  containerNumber,
  onSuccess,
}: MailAssistantImportDraftUploadDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadMessage, setUploadMessage] = React.useState<{
    success: boolean
    text: string
  } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const resetFile = React.useCallback(() => {
    setFile(null)
    setUploadMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) resetFile()
    onOpenChange(nextOpen)
  }

  const acceptExcelFile = (selected: File | undefined) => {
    if (!selected) return
    if (
      !selected.name.toLowerCase().endsWith(".xlsx") &&
      !selected.name.toLowerCase().endsWith(".xls")
    ) {
      toast.error("请上传 Excel 文件（.xlsx 或 .xls）")
      return
    }
    setFile(selected)
    setUploadMessage(null)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptExcelFile(event.target.files?.[0])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    acceptExcelFile(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("请先选择文件")
      return
    }
    if (!containerNumber) {
      toast.error("缺少柜号")
      return
    }

    setIsUploading(true)
    setUploadMessage(null)
    try {
      toast.info("正在上传…")
      const formData = new FormData()
      formData.append("file", file)
      formData.append("containerNumber", containerNumber)

      const res = await fetch("/api/google/workspace/forecast-import-draft", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        detailRowCount?: number
        trainingRecorded?: boolean
      }

      if (!res.ok || !data.ok) {
        const msg = data.error || "上传失败"
        setUploadMessage({ success: false, text: msg })
        toast.error(msg)
        return
      }

      const text = data.trainingRecorded
        ? `已覆盖 ${containerNumber} 的导入预报（${data.detailRowCount ?? 0} 行明细，已记入纠错学习）`
        : `已覆盖 ${containerNumber} 的导入预报（${data.detailRowCount ?? 0} 行明细）`

      setUploadMessage({ success: true, text })
      toast.success(text)
      onSuccess?.()
      setTimeout(() => {
        handleDialogChange(false)
      }, 1200)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : "上传失败，请检查网络连接"
      setUploadMessage({ success: false, text: msg })
      toast.error(msg)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            上传导入表
          </DialogTitle>
          <DialogDescription>
            {containerNumber ? (
              <>
                柜号 <strong className="text-foreground">{containerNumber}</strong>
                ：上传后将覆盖系统内已保存的导入预报（与订单批量导入模板相同）。
              </>
            ) : (
              "请先在列表中单选一条已有导入预报的记录。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    resetFile()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">点击选择文件或拖拽文件到此处</p>
                <p className="text-xs text-muted-foreground">支持 .xlsx、.xls</p>
              </div>
            )}
          </div>

          {uploadMessage && (
            <div
              className={`rounded-lg border p-4 mt-4 ${
                uploadMessage.success
                  ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                  : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {uploadMessage.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <p
                  className={`text-sm ${
                    uploadMessage.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"
                  }`}
                >
                  {uploadMessage.text}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogChange(false)} disabled={isUploading}>
            取消
          </Button>
          <Button onClick={() => void handleUpload()} disabled={!file || !containerNumber || isUploading}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "上传中…" : "开始上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
