/**
 * 通用批量导入Dialog框架模板
 * 
 * 使用示例：
 * 
 * export function CustomerImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
 *   return (
 *     <BaseImportDialog
 *       open={open}
 *       onOpenChange={onOpenChange}
 *       onSuccess={onSuccess}
 *       title="客户批量导入"
 *       description="支持批量导入客户信息。请先下载模板，填写数据后上传。"
 *       requiredFields="客户代码、客户名称"
 *       apiEndpoint="/api/customers/import"
 *       templateFilename="客户导入模板"
 *       generateTemplate={generateCustomerImportTemplate}
 *       downloadTemplate={downloadCustomerExcelFile}
 *     />
 *   )
 * }
 */

"use client"

import * as React from "react"
import { Download, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import ExcelJS from 'exceljs'

interface ImportResult {
  success: boolean
  total: number
  successCount: number
  errorCount: number
  errors: Array<{
    row: number
    field?: string
    message: string
    value?: any
  }>
  message?: string
}

interface BaseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  
  // 定制化配置
  title: string
  description: string
  requiredFields: string  // 例如："客户代码、客户名称"
  apiEndpoint: string     // 例如："/api/customers/import"
  templateFilename: string // 例如："客户导入模板"
  
  // 模板生成函数
  generateTemplate: (templateData?: any) => Promise<ExcelJS.Workbook>
  downloadTemplate: (workbook: ExcelJS.Workbook, filename: string) => Promise<void>
  
  // 可选：模板数据API端点（用于需要先获取参考数据的场景，如订单导入）
  templateDataEndpoint?: string
}

export function BaseImportDialog({
  open,
  onOpenChange,
  onSuccess,
  title,
  description,
  requiredFields,
  apiEndpoint,
  templateFilename,
  generateTemplate,
  downloadTemplate,
  templateDataEndpoint,
}: BaseImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadResult, setUploadResult] = React.useState<ImportResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  const [expandedSteps, setExpandedSteps] = React.useState({
    step1: true,
    step2: false,
    step3: false,
  })
  
  const toggleStep = (step: 'step1' | 'step2' | 'step3') => {
    setExpandedSteps(prev => ({ ...prev, [step]: !prev[step] }))
  }

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true)
      toast.info('正在生成模板...')
      
      // 如果需要先获取参考数据
      let templateData
      if (templateDataEndpoint) {
        console.log('[批量导入] 正在获取模板参考数据:', templateDataEndpoint)
        const response = await fetch(templateDataEndpoint)
        if (!response.ok) {
          throw new Error('获取参考数据失败')
        }
        templateData = await response.json()
        console.log('[批量导入] 获取到的参考数据:', templateData)
      }
      
      const workbook = await generateTemplate(templateData)
      const filename = `${templateFilename}_${new Date().toISOString().slice(0, 10)}.xlsx`
      await downloadTemplate(workbook, filename)
      toast.success('模板下载成功！')
    } catch (error: any) {
      console.error('下载模板失败:', error)
      toast.error(error.message || '下载模板失败，请重试')
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile)
      setUploadResult(null)
    } else {
      toast.error('请上传Excel文件（.xlsx或.xls）')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('请先选择文件')
      return
    }
    try {
      setIsUploading(true)
      setUploadResult(null)
      toast.info('正在导入...')
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      })
      const result: ImportResult = await response.json()
      setUploadResult(result)
      if (result.success) {
        toast.success(result.message)
        onSuccess?.()
        setTimeout(() => {
          onOpenChange(false)
          setFile(null)
          setUploadResult(null)
        }, 1500)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('导入失败，请检查网络连接')
      setUploadResult({
        success: false,
        total: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, message: '网络错误或服务器异常' }],
        message: '导入失败',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setUploadResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDialogChange = (open: boolean) => {
    if (!open) handleClearFile()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 步骤1：下载模板 */}
          <div className="border rounded-lg">
            <button onClick={() => toggleStep('step1')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">1</div>
                <h3 className="font-semibold text-left">下载导入模板</h3>
              </div>
              <span className="text-muted-foreground">{expandedSteps.step1 ? '收起' : '展开'}</span>
            </button>
            {expandedSteps.step1 && (
              <div className="px-4 pb-4">
                <Button onClick={handleDownloadTemplate} disabled={isDownloading} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloading ? '生成中...' : '下载模板'}
                </Button>
              </div>
            )}
          </div>
          
          {/* 步骤2：填写数据 */}
          <div className="border rounded-lg">
            <button onClick={() => toggleStep('step2')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">2</div>
                <h3 className="font-semibold text-left">填写数据</h3>
              </div>
              <span className="text-muted-foreground">{expandedSteps.step2 ? '收起' : '展开'}</span>
            </button>
            {expandedSteps.step2 && (
              <div className="px-4 pb-4">
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>必填字段：{requiredFields}</li>
                  <li><strong className="text-orange-600">强烈建议</strong>：粘贴数据时使用「选择性粘贴→值」</li>
                  <li className="ml-6 text-xs">• Windows: Ctrl+Alt+V，然后选择"值"</li>
                  <li className="ml-6 text-xs">• 或右键 → 选择性粘贴 → 值</li>
                </ul>
              </div>
            )}
          </div>
          
          {/* 步骤3：上传文件 */}
          <div className="border rounded-lg">
            <button onClick={() => toggleStep('step3')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">3</div>
                <h3 className="font-semibold text-left">上传文件</h3>
              </div>
              <span className="text-muted-foreground">{expandedSteps.step3 ? '收起' : '展开'}</span>
            </button>
            {expandedSteps.step3 && (
              <div className="px-4 pb-4 space-y-3">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDrop={handleDrop}>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleClearFile() }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">点击选择文件或拖拽文件到此处</p>
                    </div>
                  )}
                </div>
                {uploadResult && (
                  <div className={`rounded-lg border p-4 ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      {uploadResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                      <div className="flex-1">
                        <p className={`font-medium ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>{uploadResult.message}</p>
                        {!uploadResult.success && uploadResult.errors.length > 0 && (
                          <div className="space-y-1 max-h-60 overflow-y-auto mt-2">
                            {uploadResult.errors.slice(0, 10).map((error, index) => (
                              <div key={index} className="text-sm text-red-800">
                                第{error.row}行{error.field && ` [${error.field}]`}: {error.message}
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
          <Button variant="outline" onClick={() => handleDialogChange(false)} disabled={isUploading}>取消</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? '导入中...' : '开始导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
