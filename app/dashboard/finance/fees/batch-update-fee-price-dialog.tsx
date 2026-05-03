"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, Search, SlidersHorizontal, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const CONTAINER_OPTIONS = ["40HQ", "45HQ"] as const

type CustomerLite = { id: string; code?: string | null; name?: string | null }

type PreviewRow = {
  id: string | number
  fee_code: string
  fee_name: string
  unit_price: number
  currency?: string | null
  scope_type?: string | null
  container_type?: string | null
  customer_id?: string | number | null
  customer_code?: string | null
  customer_name?: string | null
}

type BatchUpdateFeePriceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function StepChip({
  n,
  label,
  active,
  done,
}: {
  n: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 min-w-0">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors",
          active && "border-blue-600 bg-blue-600 text-white shadow-md",
          done && !active && "border-emerald-500 bg-emerald-50 text-emerald-700",
          !done && !active && "border-muted-foreground/25 bg-muted/40 text-muted-foreground"
        )}
      >
        {done && !active ? "✓" : n}
      </div>
      <span
        className={cn(
          "text-[11px] sm:text-xs text-center leading-tight max-w-[100px] sm:max-w-none",
          active ? "font-semibold text-blue-700" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  )
}

export function BatchUpdateFeePriceDialog({
  open,
  onOpenChange,
  onSuccess,
}: BatchUpdateFeePriceDialogProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [allCustomers, setAllCustomers] = React.useState(false)
  const [selectedCustomers, setSelectedCustomers] = React.useState<CustomerLite[]>([])
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [customerHits, setCustomerHits] = React.useState<CustomerLite[]>([])
  const [customerLoading, setCustomerLoading] = React.useState(false)
  const [containerType, setContainerType] = React.useState<string>("40HQ")

  const [feeKeyword, setFeeKeyword] = React.useState("")
  const [previewCount, setPreviewCount] = React.useState<number | null>(null)
  const [previewSample, setPreviewSample] = React.useState<PreviewRow[]>([])
  const [matchPreviewLoading, setMatchPreviewLoading] = React.useState(false)

  const [newUnitPrice, setNewUnitPrice] = React.useState("")
  const [submitLoading, setSubmitLoading] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setStep(1)
    setAllCustomers(false)
    setSelectedCustomers([])
    setCustomerSearch("")
    setCustomerHits([])
    setContainerType("40HQ")
    setFeeKeyword("")
    setPreviewCount(null)
    setPreviewSample([])
    setNewUnitPrice("")
  }, [])

  React.useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  React.useEffect(() => {
    if (!open || allCustomers) return
    const q = customerSearch.trim()
    if (q.length < 1) {
      setCustomerHits([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        setCustomerLoading(true)
        try {
          const params = new URLSearchParams()
          params.set("page", "1")
          params.set("limit", "40")
          params.set("search", q)
          const res = await fetch(`/api/customers?${params}`)
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "加载客户失败")
          const rows = (data.data ?? []) as any[]
          setCustomerHits(
            rows.map((r) => ({
              id: String(r.id),
              code: r.code ?? null,
              name: r.name ?? null,
            }))
          )
        } catch (e) {
          setCustomerHits([])
          toast.error(e instanceof Error ? e.message : "搜索客户失败")
        } finally {
          setCustomerLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, allCustomers, open])

  const addCustomer = (c: CustomerLite) => {
    setSelectedCustomers((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev
      return [...prev, c]
    })
    setCustomerSearch("")
    setCustomerHits([])
  }

  const buildPreviewApplyBody = (action: "preview" | "apply") => {
    const kw = feeKeyword.trim()
    if (!kw) throw new Error("请输入费用名称或编码关键字")
    const priceNum =
      action === "apply" ? Number(String(newUnitPrice).replace(/,/g, "").trim()) : undefined
    if (action === "apply" && (Number.isNaN(priceNum) || priceNum! < 0)) {
      throw new Error("请填写有效的新单价（≥0）")
    }
    return {
      action,
      all_customers: allCustomers,
      customer_ids: selectedCustomers.map((c) => c.id),
      container_type: containerType,
      fee_name_search: kw,
      ...(action === "apply" ? { new_unit_price: priceNum } : {}),
    }
  }

  const runMatchPreview = async () => {
    const kw = feeKeyword.trim()
    if (!kw) {
      toast.error("请输入费用名称或编码关键字")
      return
    }
    setMatchPreviewLoading(true)
    setPreviewCount(null)
    setPreviewSample([])
    try {
      const res = await fetch("/api/finance/fees/batch-update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPreviewApplyBody("preview")),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "预览失败")
      setPreviewCount(typeof data.count === "number" ? data.count : 0)
      setPreviewSample(Array.isArray(data.sample) ? data.sample : [])
      if (data.count === 0) {
        toast.message("没有匹配的费用行，请调整关键字或返回上一步检查客户与柜型")
      } else {
        toast.success(`范围内共 ${data.count} 条费用将统一改价（示例见下方）`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "预览失败")
    } finally {
      setMatchPreviewLoading(false)
    }
  }

  const goNextFromStep1 = () => {
    if (!CONTAINER_OPTIONS.includes(containerType as (typeof CONTAINER_OPTIONS)[number])) {
      toast.error("请选择柜型")
      return
    }
    if (!allCustomers && selectedCustomers.length === 0) {
      toast.error("请勾选「全部客户」或至少选择一个客户")
      return
    }
    setFeeKeyword("")
    setPreviewCount(null)
    setPreviewSample([])
    setStep(2)
  }

  const goNextFromStep2 = () => {
    const kw = feeKeyword.trim()
    if (!kw) {
      toast.error("请输入费用名称或编码关键字")
      return
    }
    if (previewCount == null) {
      toast.error("请先点击「预览匹配」确认将影响哪些费用行")
      return
    }
    if (previewCount === 0) {
      toast.error("当前无匹配行，无法进入下一步")
      return
    }
    setNewUnitPrice("")
    setStep(3)
  }

  const runApply = async () => {
    if (previewCount == null || previewCount === 0) {
      toast.error("请返回上一步重新预览匹配")
      return
    }
    setSubmitLoading(true)
    try {
      const res = await fetch("/api/finance/fees/batch-update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPreviewApplyBody("apply")),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "提交失败")
      toast.success(`已更新 ${data.updated_count ?? 0} 条费用的单价`)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "提交失败")
    } finally {
      setSubmitLoading(false)
    }
  }

  const onFeeKeywordChange = (v: string) => {
    setFeeKeyword(v)
    setPreviewCount(null)
    setPreviewSample([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            批量调价
          </DialogTitle>
          <DialogDescription>
            第一步限定客户与柜型；第二步用关键字匹配<strong className="text-foreground">范围内所有客户</strong>下该柜型相关费用行并预览；第三步填写<strong className="text-foreground">统一新单价</strong>后一次提交。
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-start justify-between gap-1 max-w-2xl mx-auto">
            <StepChip n={1} label="客户与柜型" active={step === 1} done={step > 1} />
            <div className="mt-[18px] h-0.5 flex-1 bg-border min-w-[12px] max-w-[80px]" />
            <StepChip n={2} label="匹配费用" active={step === 2} done={step > 2} />
            <div className="mt-[18px] h-0.5 flex-1 bg-border min-w-[12px] max-w-[80px]" />
            <StepChip n={3} label="新单价" active={step === 3} done={false} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-h-[50vh] sm:max-h-[52vh]">
          <div className="space-y-5 pb-2">
            {step === 1 && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">柜型</Label>
                  <RadioGroup
                    value={containerType}
                    onValueChange={setContainerType}
                    className="flex flex-wrap gap-6"
                  >
                    {CONTAINER_OPTIONS.map((ct) => (
                      <div key={ct} className="flex items-center space-x-2">
                        <RadioGroupItem value={ct} id={`ct-${ct}`} />
                        <Label htmlFor={`ct-${ct}`} className="cursor-pointer text-base font-medium">
                          {ct}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="all-cust"
                      checked={allCustomers}
                      onCheckedChange={(v) => {
                        setAllCustomers(Boolean(v))
                        if (v) {
                          setSelectedCustomers([])
                          setCustomerSearch("")
                          setCustomerHits([])
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor="all-cust" className="cursor-pointer text-base font-semibold">
                        全部客户
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        勾选后，关键字将匹配系统中该柜型下、所有客户相关的费用行并统一改价。
                      </p>
                    </div>
                  </div>

                  {!allCustomers && (
                    <div className="space-y-3 pt-1 border-t">
                      <Label className="text-base font-semibold">指定客户</Label>
                      <p className="text-sm text-muted-foreground">
                        模糊搜索添加；已选列表可滚动，避免遮挡底部按钮。
                      </p>
                      <div className="relative">
                        <Input
                          placeholder="输入客户代码或名称搜索…"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pr-10"
                        />
                        {customerLoading && (
                          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {customerHits.length > 0 && (
                        <div className="max-h-32 overflow-y-auto overscroll-contain rounded-lg border bg-background text-sm shadow-sm">
                          {customerHits.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/80 border-b last:border-0"
                              onClick={() => addCustomer(h)}
                            >
                              <span className="min-w-0 truncate">
                                {h.code ? (
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{h.code}</span>
                                ) : null}
                                <span className="font-medium">{h.name || h.id}</span>
                              </span>
                              <span className="text-xs text-blue-600 font-medium shrink-0">添加</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                          已选 {selectedCustomers.length} 个（可滚动）
                        </Label>
                        {selectedCustomers.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">暂无已选客户</p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border bg-card">
                            <ul className="divide-y">
                              {selectedCustomers.map((c) => (
                                <li
                                  key={c.id}
                                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30"
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    <Badge variant="secondary" className="shrink-0">
                                      {c.code || "—"}
                                    </Badge>
                                    <span className="truncate text-sm font-medium">{c.name || c.id}</span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() =>
                                      setSelectedCustomers((prev) => prev.filter((x) => x.id !== c.id))
                                    }
                                    aria-label="移除"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">当前范围：</span>
                  <span className="font-semibold text-foreground">{containerType}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  {allCustomers ? (
                    <span className="font-medium">全部客户</span>
                  ) : (
                    <span className="font-medium">已选 {selectedCustomers.length} 个客户</span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">费用名称 / 编码（模糊）</Label>
                  <p className="text-sm text-muted-foreground">
                    将匹配范围内<strong className="text-foreground">所有客户</strong>下、该柜型且名称或编码包含关键字的费用行，并<strong className="text-foreground">统一改为同一新单价</strong>，无需逐个点选。
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Input
                      placeholder="如 仓储、Storage、拆柜…"
                      value={feeKeyword}
                      onChange={(e) => onFeeKeywordChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void runMatchPreview()
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 h-10"
                      onClick={() => void runMatchPreview()}
                      disabled={matchPreviewLoading}
                    >
                      {matchPreviewLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      预览匹配
                    </Button>
                  </div>
                  {previewCount == null && (
                    <p className="text-xs text-muted-foreground">修改关键字后需重新点「预览匹配」。</p>
                  )}
                </div>

                {previewCount != null && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">匹配结果</span>
                      <span className="text-muted-foreground">
                        共 <strong className="text-foreground">{previewCount}</strong> 条
                        {previewCount > previewSample.length
                          ? `（下方滚动展示前 ${previewSample.length} 条）`
                          : ""}
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 sticky top-0 z-[1]">
                            <TableHead className="w-[72px]">ID</TableHead>
                            <TableHead>费用</TableHead>
                            <TableHead className="w-[88px]">柜型</TableHead>
                            <TableHead className="text-right w-[100px]">当前单价</TableHead>
                            <TableHead>客户 / 归属</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewSample.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                无匹配
                              </TableCell>
                            </TableRow>
                          ) : (
                            previewSample.map((row) => (
                              <TableRow key={String(row.id)}>
                                <TableCell className="font-mono text-xs">{String(row.id)}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{row.fee_name}</div>
                                  <div className="text-xs text-muted-foreground">{row.fee_code}</div>
                                </TableCell>
                                <TableCell className="text-xs">{row.container_type?.trim() || "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {Number(row.unit_price).toFixed(2)} {row.currency ?? ""}
                                </TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">
                                  {row.scope_type === "all"
                                    ? "所有客户"
                                    : row.customer_name || row.customer_code || row.customer_id || "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50/80 to-background p-4 dark:border-blue-900 dark:from-blue-950/40">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    即将批量改价
                  </p>
                  <ul className="text-sm space-y-1.5 text-foreground">
                    <li>
                      <span className="text-muted-foreground">柜型：</span>
                      <strong>{containerType}</strong>
                    </li>
                    <li>
                      <span className="text-muted-foreground">客户范围：</span>
                      {allCustomers ? "全部客户" : `已选 ${selectedCustomers.length} 个客户`}
                    </li>
                    <li>
                      <span className="text-muted-foreground">关键字：</span>
                      <strong className="font-mono">{feeKeyword.trim()}</strong>
                    </li>
                    <li>
                      <span className="text-muted-foreground">将更新条数：</span>
                      <strong>{previewCount ?? 0}</strong>
                    </li>
                  </ul>
                </div>

                <div className="grid gap-2 max-w-sm">
                  <Label htmlFor="batch-new-price" className="text-base font-semibold">
                    统一新单价
                  </Label>
                  <Input
                    id="batch-new-price"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="写入上述所有匹配行"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(e.target.value)}
                  />
                </div>

                {previewSample.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">匹配示例（节选）</Label>
                    <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border text-xs">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead>费用</TableHead>
                            <TableHead className="text-right">当前价</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewSample.slice(0, 20).map((row) => (
                            <TableRow key={String(row.id)}>
                              <TableCell className="py-2">
                                {row.fee_name}{" "}
                                <span className="text-muted-foreground">({row.fee_code})</span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums py-2">
                                {Number(row.unit_price).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2 sm:justify-between bg-muted/10">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (step === 2) {
                    setStep(1)
                  }
                  if (step === 3) {
                    setStep(2)
                  }
                }}
              >
                上一步
              </Button>
            )}
            {step === 1 && (
              <Button type="button" size="lg" className="min-w-[168px] font-medium" onClick={goNextFromStep1}>
                下一步：匹配费用
              </Button>
            )}
            {step === 2 && (
              <Button type="button" size="lg" className="min-w-[168px] font-medium" onClick={goNextFromStep2}>
                下一步：填写单价
              </Button>
            )}
            {step === 3 && (
              <Button
                type="button"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md min-w-[140px]"
                onClick={() => void runApply()}
                disabled={submitLoading}
              >
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认批量改价
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
