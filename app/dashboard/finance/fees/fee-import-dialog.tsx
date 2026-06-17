"use client"

import * as React from "react"
import {
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { FuzzySearchSelect } from "@/components/ui/fuzzy-search-select"
import { toast } from "sonner"
import {
  generateFeeImportTemplate,
  downloadFeeExcelFile,
} from "@/lib/utils/fee-excel-template"

interface ImportResult {
  success: boolean
  total: number
  successCount: number
  errorCount: number
  errors: Array<{ row: number; field?: string; message: string }>
  message?: string
}

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
  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadResult, setUploadResult] = React.useState<ImportResult | null>(
    null
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [expandedSteps, setExpandedSteps] = React.useState({
    step1: true,
    step2: false,
    step3: false,
  })

  const resetState = React.useCallback(() => {
    setCustomerId(null)
    setFile(null)
    setUploadResult(null)
    setExpandedSteps({ step1: true, step2: false, step3: false })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  React.useEffect(() => {
    if (!open) resetState()
  }, [open, resetState])

  const toggleStep = (step: "step1" | "step2" | "step3") => {
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }))
  }

  const loadCustomerOptions = React.useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams()
      if (search.trim()) {
        params.set("search", search.trim())
        params.set("unlimited", "true")
      } else {
        params.set("limit", "100")
      }
      const res = await fetch(`/api/customers?${params}`)
      if (!res.ok) return []
      const data = await res.json()
      if (!Array.isArray(data.data)) return []
      return data.data.map((c: { id: string | number; code?: string; name?: string }) => ({
        value: String(c.id),
        label: c.code || c.name || String(c.id),
        description: c.name && c.code ? c.name : undefined,
      }))
    } catch {
      return []
    }
  }, [])

  const handleDownloadTemplate = async () => {
    if (!customerId) {
      toast.error("请先选择客户代码")
      return
    }
    try {
      setIsDownloading(true)
      toast.info("正在生成客户费用表...")
      const res = await fetch(
        `/api/finance/fees/customer-template?customerId=${encodeURIComponent(customerId)}`
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "获取模板数据失败")
      }
      const workbook = await generateFeeImportTemplate({
        customer: data.customer,
        rows: data.rows,
      })
      const code = data.customer?.code ?? "客户"
      const filename = `费用表_${code}_${new Date().toISOString().slice(0, 10)}.xlsx`
      await downloadFeeExcelFile(workbook, filename)
      toast.success(`已下载 ${data.rows?.length ?? 0} 条费用`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "下载模板失败")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setUploadResult(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    if (
      droppedFile &&
      (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))
    ) {
      setFile(droppedFile)
      setUploadResult(null)
    } else {
      toast.error("请上传 Excel 文件（.xlsx 或 .xls）")
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("请先选择文件")
      return
    }
    try {
      setIsUploading(true)
      setUploadResult(null)
      toast.info("正在导入...")
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/finance/fees/import", {
        method: "POST",
        body: formData,
      })
      let result: ImportResult
      try {
        result = await response.json()
      } catch {
        throw new Error(
          response.ok
            ? "服务器返回格式异常"
            : `导入失败（HTTP ${response.status}）`
        )
      }
      if (!response.ok) {
        const msg =
          (typeof result === "object" &&
            result &&
            ("error" in result
              ? String((result as { error?: string }).error)
              : result.message)) ||
          `导入失败（HTTP ${response.status}）`
        toast.error(msg)
        setUploadResult({
          success: false,
          total: 0,
          successCount: 0,
          errorCount: 1,
          errors: [{ row: 0, message: msg }],
          message: msg,
        })
        return
      }
      setUploadResult(result)
      if (result.success) {
        toast.success(result.message)
        onSuccess?.()
        setTimeout(() => {
          onOpenChange(false)
          resetState()
        }, 1500)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("导入失败，请检查网络连接")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            费用批量导入
          </DialogTitle>
          <DialogDescription>
            先选择客户并下载该客户的完整费用表，在 Excel 中修改单价等信息后上传。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => toggleStep("step1")}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                  1
                </div>
                <h3 className="font-semibold text-left">选择客户并下载费用表</h3>
              </div>
              <span className="text-muted-foreground">
                {expandedSteps.step1 ? "收起" : "展开"}
              </span>
            </button>
            {expandedSteps.step1 && (
              <div className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>客户代码 *</Label>
                  <FuzzySearchSelect
                    value={customerId}
                    onChange={(value) => {
                      setCustomerId(value ? String(value) : null)
                    }}
                    loadOptions={loadCustomerOptions}
                    placeholder="搜索并选择客户代码"
                    searchPlaceholder="输入客户代码或名称..."
                  />
                </div>
                <Button
                  onClick={handleDownloadTemplate}
                  disabled={isDownloading || !customerId}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloading ? "生成中..." : "下载该客户费用表"}
                </Button>
              </div>
            )}
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => toggleStep("step2")}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                  2
                </div>
                <h3 className="font-semibold text-left">在 Excel 中修改</h3>
              </div>
              <span className="text-muted-foreground">
                {expandedSteps.step2 ? "收起" : "展开"}
              </span>
            </button>
            {expandedSteps.step2 && (
              <div className="px-4 pb-4">
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>可直接修改「单价」等字段；请勿改「客户代码」</li>
                  <li>「归属范围」保持 customers</li>
                  <li>
                    <strong className="text-orange-600">强烈建议</strong>
                    ：粘贴时使用「选择性粘贴 → 值」
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => toggleStep("step3")}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                  3
                </div>
                <h3 className="font-semibold text-left">上传文件</h3>
              </div>
              <span className="text-muted-foreground">
                {expandedSteps.step3 ? "收起" : "展开"}
              </span>
            </button>
            {expandedSteps.step3 && (
              <div className="px-4 pb-4 space-y-3">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
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
                          setFile(null)
                          setUploadResult(null)
                          if (fileInputRef.current) fileInputRef.current.value = ""
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        点击选择文件或拖拽到此处
                      </p>
                    </div>
                  )}
                </div>
                {uploadResult && (
                  <div
                    className={`rounded-lg border p-4 ${uploadResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                  >
                    <div className="flex items-start gap-3">
                      {uploadResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div className="flex-1">
                        <p
                          className={`font-medium ${uploadResult.success ? "text-green-900" : "text-red-900"}`}
                        >
                          {uploadResult.message}
                        </p>
                        {!uploadResult.success &&
                          uploadResult.errors.length > 0 && (
                            <div className="space-y-1 max-h-60 overflow-y-auto mt-2">
                              {uploadResult.errors.slice(0, 10).map((error, index) => (
                                <div key={index} className="text-sm text-red-800">
                                  第{error.row}行
                                  {error.field && ` [${error.field}]`}: {error.message}
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            取消
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "导入中..." : "开始导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
