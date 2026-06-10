"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, MessageSquareWarning, Upload } from "lucide-react"
import { toast } from "sonner"
import type { MailAssistantImportRow } from "./mail-assistant-import-table"

type MailAssistantFeedbackSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: MailAssistantImportRow[]
  onSubmitted?: () => void
}

const FEEDBACK_ISSUE_TYPES = [
  { value: "wrong_file", label: "源预报找错了" },
  { value: "not_found", label: "明明有却显示暂无" },
  { value: "other", label: "其他" },
] as const

type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number]["value"]

function normalizeIssueType(
  value: string | undefined,
  fallback: FeedbackIssueType
): FeedbackIssueType {
  if (value && FEEDBACK_ISSUE_TYPES.some((t) => t.value === value)) {
    return value as FeedbackIssueType
  }
  return fallback
}

type RowDraft = {
  issueType: FeedbackIssueType
  comment: string
  file: File | null
}

export function MailAssistantFeedbackSheet({
  open,
  onOpenChange,
  rows,
  onSubmitted,
}: MailAssistantFeedbackSheetProps) {
  const [drafts, setDrafts] = React.useState<Record<string, RowDraft>>({})
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const next: Record<string, RowDraft> = {}
    for (const row of rows) {
      const key = `${row.containerNumber}|${row.orderDateKey}`
      const defaultIssueType: FeedbackIssueType =
        row.sourceForecast?.status === "not_found" ? "not_found" : "wrong_file"
      const existing = drafts[key]
      next[key] = {
        issueType: normalizeIssueType(existing?.issueType, defaultIssueType),
        comment: existing?.comment ?? "",
        file: existing?.file ?? null,
      }
    }
    setDrafts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随勾选行初始化
  }, [open, rows])

  const updateDraft = (key: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }

  const handleSubmit = async () => {
    if (rows.length === 0) {
      toast.error("请先在表格中勾选要反馈的记录")
      return
    }

    setSubmitting(true)
    let ok = 0
    try {
      for (const row of rows) {
        const key = `${row.containerNumber}|${row.orderDateKey}`
        const draft = drafts[key]
        if (!draft) continue

        const form = new FormData()
        form.append("containerNumber", row.containerNumber)
        form.append("orderDateKey", row.orderDateKey)
        form.append("issueType", draft.issueType)
        if (draft.comment.trim()) form.append("comment", draft.comment.trim())
        if (row.sourceForecast?.status === "found") {
          form.append(
            "wrongSourceMeta",
            JSON.stringify({
              filename: row.sourceForecast.label,
              downloadUrl: row.sourceForecast.downloadUrl,
              resolveReason: row.sourceForecast.resolveReason,
            })
          )
        }
        if (draft.file) form.append("correctFile", draft.file)

        const res = await fetch("/api/google/workspace/forecast-feedback", {
          method: "POST",
          body: form,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `柜号 ${row.containerNumber} 反馈失败`)
        ok++
      }

      toast.success(`已提交 ${ok} 条反馈，后续 AI 会参考这些纠正`)
      onOpenChange(false)
      onSubmitted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-600" />
            预报纠错反馈
          </SheetTitle>
          <SheetDescription>
            已勾选 {rows.length} 条。用于<strong className="text-foreground">找预报找错</strong>等情形。
            导入预报在编辑页保存后，系统会自动对比并学习，无需在此重复填写。
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
            {rows.map((row) => {
              const key = `${row.containerNumber}|${row.orderDateKey}`
              const draft = drafts[key]
              if (!draft) return null
              return (
                <div key={key} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <div>
                    <p className="font-semibold">{row.containerNumber}</p>
                    <p className="text-xs text-muted-foreground">订单日期 {row.orderDate}</p>
                    {row.sourceForecast?.label && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        当前源预报：{row.sourceForecast.label}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>问题类型</Label>
                    <Select
                      value={draft.issueType}
                      onValueChange={(v) => updateDraft(key, { issueType: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEEDBACK_ISSUE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>说明（可选）</Label>
                    <Textarea
                      rows={2}
                      placeholder="例如：应选邮件 xxx 里的预报.xlsx"
                      value={draft.comment}
                      onChange={(e) => updateDraft(key, { comment: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>上传正确源预报（可选）</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        className="h-9 text-xs"
                        onChange={(e) =>
                          updateDraft(key, { file: e.target.files?.[0] ?? null })
                        }
                      />
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            提交反馈
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
