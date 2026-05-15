"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { InvoicePdfDownloadButton } from "@/components/finance/invoice-pdf-download-button"

const STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  audited: "已审核",
  issued: "已开票",
  void: "作废",
}

/** 将发票日期格式化为 `<input type="date">` 的 YYYY-MM-DD；空则返回当天 */
function toDateInputValue(v: unknown): string {
  if (v == null || v === "") {
    return new Date().toISOString().slice(0, 10)
  }
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

interface LineRow {
  id: string | number
  fee_id?: string | number | null
  fee_code?: string
  fee_name?: string
  unit?: string
  unit_price: number | string
  quantity: number | string
  total_amount: number | string
  currency?: string
  line_notes?: string | null
  /** 仓储账单：拆柜/入库时间 */
  storage_in_at?: string | null
  /** 仓储账单：预约出库时间 */
  storage_out_at?: string | null
}

export interface InvoiceBillDetailClientProps {
  invoiceId: string
  invoice: {
    invoice_id: string | number
    /** 为 penalty 时表示负数账单，明细单价可为负 */
    invoice_type?: string | null
    customer_id?: string | number
    invoice_number?: string
    invoice_date?: string
    status?: string
    total_amount?: number
    currency?: string
    notes?: string | null
    customers?: { code?: string; name?: string } | null
    orders?: {
      order_number?: string
      container_type?: string | null
    } | null
  }
  /** 返回列表页的路径 */
  backListHref: string
  /** 页面标题前缀，如「直送账单」「拆柜账单」 */
  billKindLabel: string
}

export function InvoiceBillDetailClient({
  invoiceId,
  invoice,
  backListHref,
  billKindLabel,
}: InvoiceBillDetailClientProps) {
  const isPenaltyInvoice = invoice.invoice_type === "penalty"
  const isStorageInvoice = invoice.invoice_type === "storage"
  const router = useRouter()
  const [invoiceStatus, setInvoiceStatus] = React.useState(invoice.status ?? "draft")
  const [statusSaving, setStatusSaving] = React.useState<"audited" | "issued" | null>(null)
  const [issuedDialogOpen, setIssuedDialogOpen] = React.useState(false)
  const [issuedDateInput, setIssuedDateInput] = React.useState(() =>
    toDateInputValue(invoice.invoice_date)
  )

  React.useEffect(() => {
    setInvoiceStatus(invoice.status ?? "draft")
  }, [invoice.status])

  const updateInvoiceStatus = React.useCallback(
    async (next: "audited") => {
      if (invoiceStatus === "void") {
        toast.error("作废账单不可修改状态")
        return
      }
      if (invoiceStatus === next) return
      setStatusSaving(next)
      try {
        const res = await fetch(`/api/finance/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            typeof payload.error === "string" ? payload.error : "更新状态失败"
          throw new Error(msg)
        }
        const nextStatus = payload.data?.status ?? next
        setInvoiceStatus(typeof nextStatus === "string" ? nextStatus : next)
        toast.success("已设为已审核")
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "更新状态失败")
      } finally {
        setStatusSaving(null)
      }
    },
    [invoiceId, invoiceStatus, router]
  )

  const openIssuedDialog = React.useCallback(() => {
    if (invoiceStatus === "void") {
      toast.error("作废账单不可修改状态")
      return
    }
    if (invoiceStatus === "issued") return
    if (statusSaving !== null) return
    if (issuedDialogOpen) return
    setIssuedDateInput(toDateInputValue(invoice.invoice_date))
    setIssuedDialogOpen(true)
  }, [invoiceStatus, statusSaving, invoice.invoice_date, issuedDialogOpen])

  const confirmIssuedWithDate = React.useCallback(async () => {
    if (invoiceStatus === "void") {
      toast.error("作废账单不可修改状态")
      return
    }
    const dateStr = issuedDateInput?.trim()
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      toast.error("请选择有效的发票日期")
      return
    }
    setStatusSaving("issued")
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "issued",
          invoice_date: dateStr,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof payload.error === "string" ? payload.error : "更新状态失败"
        throw new Error(msg)
      }
      const nextStatus = payload.data?.status ?? "issued"
      setInvoiceStatus(typeof nextStatus === "string" ? nextStatus : "issued")
      setIssuedDialogOpen(false)
      toast.success("已设为已开票")
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "更新状态失败")
    } finally {
      setStatusSaving(null)
    }
  }, [invoiceId, invoiceStatus, issuedDateInput, router])

  const [lines, setLines] = React.useState<LineRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [addOpen, setAddOpen] = React.useState(false)
  const [feeSearch, setFeeSearch] = React.useState("")
  const [feeResults, setFeeResults] = React.useState<any[]>([])
  const [feeLoading, setFeeLoading] = React.useState(false)
  const [selectedFee, setSelectedFee] = React.useState<{
    id: number
    fee_code: string
    fee_name: string
    unit?: string
    unit_price: number
    currency?: string
    scope_type?: string
    container_type?: string
    description?: string
  } | null>(null)
  const [quantity, setQuantity] = React.useState("1")
  const [lineUnitPrice, setLineUnitPrice] = React.useState("")
  const [lineNotes, setLineNotes] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [editLineOpen, setEditLineOpen] = React.useState(false)
  const [editLineId, setEditLineId] = React.useState<string | number | null>(null)
  const [editQuantity, setEditQuantity] = React.useState("")
  const [editUnitPrice, setEditUnitPrice] = React.useState("")
  const [editLineNotes, setEditLineNotes] = React.useState("")
  const [deleteLineId, setDeleteLineId] = React.useState<string | number | null>(null)

  const loadLines = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/lines`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : "加载明细失败"
        throw new Error(msg)
      }
      setLines(data.data ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? "加载明细失败")
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  React.useEffect(() => {
    loadLines()
  }, [loadLines])

  const formatBillDateDisplay = React.useCallback((v: unknown) => {
    if (v == null || v === "") return "—"
    const s = String(v)
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    return s.includes("T") ? s.replace("T", " ").slice(0, 19) : s
  }, [])

  /** searchText：不传或空字符串 = 仅柜型/客户范围内全部费用；有值 = 模糊匹配编码/名称 */
  const loadFeeOptions = React.useCallback(
    async (searchText?: string | null) => {
      const cid = invoice.customer_id
      if (cid == null || cid === "") {
        setFeeResults([])
        return
      }
      setFeeLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("for_invoice_line", "true")
        params.set("customer_id", String(cid))
        const ct = invoice.orders?.container_type
        if (ct != null && String(ct).trim() !== "") {
          params.set("container_type", String(ct).trim())
        }
        const q = searchText != null ? String(searchText).trim() : ""
        if (q) {
          params.set("search", q)
        }
        params.set("unlimited", "true")
        const res = await fetch(`/api/finance/fees?${params.toString()}`)
        if (!res.ok) throw new Error("加载费用失败")
        const data = await res.json()
        setFeeResults(data.data ?? data.items ?? [])
      } catch (e: any) {
        toast.error(e?.message ?? "加载失败")
        setFeeResults([])
      } finally {
        setFeeLoading(false)
      }
    },
    [invoice.customer_id, invoice.orders?.container_type]
  )

  const openAdd = () => {
    setFeeSearch("")
    setFeeResults([])
    setSelectedFee(null)
    setQuantity("1")
    setLineUnitPrice("")
    setLineNotes("")
    setFeeLoading(true)
    setAddOpen(true)
    void loadFeeOptions(null)
  }

  const reselectFee = () => {
    setSelectedFee(null)
    setQuantity("1")
    setLineUnitPrice("")
    setLineNotes("")
    setFeeSearch("")
    setFeeLoading(true)
    void loadFeeOptions(null)
  }

  const runFeeSearch = () => {
    void loadFeeOptions(feeSearch)
  }

  const addLine = async () => {
    if (!selectedFee) {
      toast.error("请先选择一条费用")
      return
    }
    const q = parseFloat(quantity)
    if (Number.isNaN(q) || q <= 0) {
      toast.error("数量必须大于 0")
      return
    }
    const p = parseFloat(lineUnitPrice)
    if (Number.isNaN(p) || (!isPenaltyInvoice && p < 0)) {
      toast.error(isPenaltyInvoice ? "请输入有效单价（可为负数）" : "请输入有效单价")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee_id: selectedFee.id,
          quantity: q,
          unit_price: p,
          line_notes: lineNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? "添加失败")
      }
      toast.success("已添加明细")
      setAddOpen(false)
      loadLines()
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "添加失败")
    } finally {
      setSubmitting(false)
    }
  }

  const openEditLine = (line: LineRow) => {
    setEditLineId(line.id)
    setEditQuantity(String(line.quantity))
    setEditUnitPrice(String(line.unit_price))
    setEditLineNotes(line.line_notes ?? "")
    setEditLineOpen(true)
  }

  const saveEditLine = async () => {
    if (editLineId == null) return
    const q = parseFloat(editQuantity)
    const p = parseFloat(editUnitPrice)
    if (Number.isNaN(q) || q <= 0) {
      toast.error("数量必须大于 0")
      return
    }
    if (Number.isNaN(p) || (!isPenaltyInvoice && p < 0)) {
      toast.error(isPenaltyInvoice ? "单价无效（负数账单允许负单价）" : "单价不能为负数")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/lines/${editLineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: q,
          unit_price: p,
          line_notes: editLineNotes,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? "更新失败")
      }
      toast.success("已更新")
      setEditLineOpen(false)
      setEditLineId(null)
      loadLines()
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "更新失败")
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteLine = async () => {
    if (deleteLineId == null) return
    const lineId = deleteLineId
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/finance/invoices/${invoiceId}/lines/${encodeURIComponent(String(lineId))}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? "删除失败")
      }
      toast.success("已删除")
      setDeleteLineId(null)
      loadLines()
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "删除失败")
    } finally {
      setSubmitting(false)
    }
  }

  const customerLabel = invoice.customers
    ? [invoice.customers.code, invoice.customers.name].filter(Boolean).join(" ") || "-"
    : "-"
  const orderLabel = invoice.orders?.order_number ?? "-"
  const resolvedUnitPrice = React.useMemo(() => {
    if (!selectedFee) return 0
    if (lineUnitPrice.trim() !== "") {
      const p = parseFloat(lineUnitPrice)
      if (Number.isFinite(p)) return p
    }
    return Number(selectedFee.unit_price)
  }, [selectedFee, lineUnitPrice])

  const total =
    selectedFee && quantity
      ? (parseFloat(quantity) || 0) * (Number.isFinite(resolvedUnitPrice) ? resolvedUnitPrice : 0)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backListHref}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold min-w-0 flex-1">
          {billKindLabel} - {invoice.invoice_number ?? invoiceId}
        </h1>
        <InvoicePdfDownloadButton
          invoiceId={invoiceId}
          label="生成账单 PDF"
          successToast="已打开账单 PDF"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
          <CardTitle>主行信息</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                invoiceStatus === "void" ||
                invoiceStatus === "audited" ||
                statusSaving !== null
              }
              onClick={() => void updateInvoiceStatus("audited")}
            >
              {statusSaving === "audited" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中
                </>
              ) : (
                "已审核"
              )}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                invoiceStatus === "void" ||
                invoiceStatus === "issued" ||
                statusSaving !== null ||
                issuedDialogOpen
              }
              onClick={openIssuedDialog}
            >
              {statusSaving === "issued" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中
                </>
              ) : (
                "已开票"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span className="text-muted-foreground">发票号</span>
            <span>{invoice.invoice_number ?? "-"}</span>
            <span className="text-muted-foreground">客户</span>
            <span>{customerLabel}</span>
            <span className="text-muted-foreground">订单号</span>
            <span>{orderLabel}</span>
            <span className="text-muted-foreground">柜型</span>
            <span>{invoice.orders?.container_type?.trim() || "—"}</span>
            <span className="text-muted-foreground">开票日期</span>
            <span>{invoice.invoice_date ? String(invoice.invoice_date).slice(0, 10) : "-"}</span>
            <span className="text-muted-foreground">状态</span>
            <span>
              <Badge variant="secondary">
                {STATUS_MAP[invoiceStatus] ?? invoiceStatus}
              </Badge>
            </span>
            <span className="text-muted-foreground">总金额</span>
            <span>{invoice.total_amount != null ? Number(invoice.total_amount).toFixed(2) : "0.00"} {invoice.currency ?? "USD"}</span>
            {invoice.notes && (
              <>
                <span className="text-muted-foreground">备注</span>
                <span>{invoice.notes}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>账单明细</CardTitle>
          {!isStorageInvoice && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              添加明细
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {isStorageInvoice
                ? "暂无明细：请确认订单已入库，扣货行已关联预约且预约已填写出库时间；系统将自动同步。"
                : "暂无明细，点击「添加明细」选择费用并填写单价、数量与备注。"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isStorageInvoice && (
                    <>
                      <TableHead>入库时间</TableHead>
                      <TableHead>出库时间</TableHead>
                    </>
                  )}
                  <TableHead>费用编码</TableHead>
                  <TableHead>费用名称</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                  <TableHead className="min-w-[140px]">备注</TableHead>
                  {!isStorageInvoice && <TableHead className="w-[100px]">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow
                    key={line.id}
                    className={
                      invoiceStatus === "issued"
                        ? "bg-green-50/90 border-green-100 hover:bg-green-50 dark:bg-green-950/30 dark:border-green-900 dark:hover:bg-green-950/40"
                        : undefined
                    }
                  >
                    {isStorageInvoice && (
                      <>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatBillDateDisplay(line.storage_in_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatBillDateDisplay(line.storage_out_at)}
                        </TableCell>
                      </>
                    )}
                    <TableCell>{line.fee_code ?? "-"}</TableCell>
                    <TableCell>{line.fee_name ?? "-"}</TableCell>
                    <TableCell>{line.unit ?? "-"}</TableCell>
                    <TableCell className="text-right">{Number(line.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span>{Number(line.quantity)}</span>
                    </TableCell>
                    <TableCell className="text-right">{Number(line.total_amount).toFixed(2)} {line.currency ?? ""}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] whitespace-pre-wrap">
                      {line.line_notes ?? "—"}
                    </TableCell>
                    {!isStorageInvoice && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditLine(line)}
                            title="编辑单价、数量、备注"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (line.id == null || line.id === "") {
                                toast.error("明细缺少 ID，无法删除")
                                return
                              }
                              setDeleteLineId(line.id)
                            }}
                            title="删除该明细"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加明细</DialogTitle>
            <DialogDescription>
              {isPenaltyInvoice
                ? "负数账单：单价可为负，总价按数量×单价计算。可从费用表选择后再改为负单价。"
                : "列表默认展示当前客户且柜型匹配的全部费用；输入关键字后点击「搜索」进行模糊筛选。下方可编辑单价、数量、备注，与编辑明细规则一致。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedFee && (
              <div className="space-y-2">
                <Label htmlFor="fee-search-input">搜索费用（编码或名称）</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input
                    id="fee-search-input"
                    placeholder="留空则展示全部；输入后点「搜索」模糊匹配"
                    value={feeSearch}
                    onChange={(e) => setFeeSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        runFeeSearch()
                      }
                    }}
                    className="flex-1"
                  />
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={runFeeSearch}
                      disabled={feeLoading}
                    >
                      {feeLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      搜索
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {feeLoading && !selectedFee && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
              </div>
            )}
            {!selectedFee && !feeLoading && feeResults.length === 0 && (
              <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                没有符合条件的费用，请检查客户、柜型或搜索关键字。
              </p>
            )}
            {feeResults.length > 0 && !selectedFee && (
              <div className="border rounded-md overflow-auto max-h-[min(50vh,320px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>费用编码</TableHead>
                      <TableHead>费用名称</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>币种</TableHead>
                      <TableHead>归属范围</TableHead>
                      <TableHead>柜型</TableHead>
                      <TableHead>说明</TableHead>
                      <TableHead>客户名称</TableHead>
                      <TableHead className="w-20">选择</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeResults.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.fee_code}</TableCell>
                        <TableCell>{f.fee_name}</TableCell>
                        <TableCell>{f.unit ?? "-"}</TableCell>
                        <TableCell>{Number(f.unit_price).toFixed(2)}</TableCell>
                        <TableCell>{f.currency ?? "-"}</TableCell>
                        <TableCell>{f.scope_type === "all" ? "所有客户" : f.scope_type === "customers" ? "指定客户" : f.scope_type ?? "-"}</TableCell>
                        <TableCell>{f.container_type ?? "-"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{f.description ?? "-"}</TableCell>
                        <TableCell>
                          {f.customers?.name ??
                            f.customers?.code ??
                            (!f.customer_id && f.scope_type === "all" ? "默认" : "—")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedFee({
                                id: Number(f.id),
                                fee_code: f.fee_code,
                                fee_name: f.fee_name,
                                unit: f.unit,
                                unit_price: Number(f.unit_price),
                                currency: f.currency,
                                scope_type: f.scope_type,
                                container_type: f.container_type,
                                description: f.description,
                              })
                              setQuantity("1")
                              setLineUnitPrice(
                                Number.isFinite(Number(f.unit_price))
                                  ? String(Number(f.unit_price))
                                  : ""
                              )
                              setLineNotes("")
                            }}
                          >
                            选择
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {selectedFee && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold">待添加明细</p>
                    <p className="text-sm text-muted-foreground break-words">
                      <span className="font-medium text-foreground">{selectedFee.fee_code}</span>
                      {" · "}
                      {selectedFee.fee_name}
                      {selectedFee.unit ? (
                        <span className="text-muted-foreground">（{selectedFee.unit}）</span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 w-full sm:w-auto"
                    onClick={reselectFee}
                  >
                    重选费用
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="add-line-unit-price">单价</Label>
                    <Input
                      id="add-line-unit-price"
                      type="number"
                      min={isPenaltyInvoice ? undefined : 0}
                      step="any"
                      value={lineUnitPrice}
                      onChange={(e) => setLineUnitPrice(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isPenaltyInvoice
                        ? "负数账单可填负单价；亦可先选费用再改为负数。"
                        : "默认带出费用表单价，可按本单调整"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-line-qty">数量</Label>
                    <Input
                      id="add-line-qty"
                      type="number"
                      min={0.0001}
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="add-line-notes">备注</Label>
                    <Textarea
                      id="add-line-notes"
                      value={lineNotes}
                      onChange={(e) => setLineNotes(e.target.value)}
                      placeholder="如：分仓占比、计费说明等"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    总价（{selectedFee.currency ?? "USD"}）：
                    <strong className="ml-1 tabular-nums">{total.toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={addLine} disabled={!selectedFee || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteLineId != null}
        onOpenChange={(open) => {
          if (!open && !submitting) setDeleteLineId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除明细</DialogTitle>
            <DialogDescription>
              确定删除该条账单明细吗？删除后将重新汇总账单总金额。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteLineId(null)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteLine()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLineOpen} onOpenChange={setEditLineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑明细</DialogTitle>
            <DialogDescription>
              {isPenaltyInvoice
                ? "负数账单：单价可为负。总价按数量×单价重算，仅更新本行。"
                : "修改单价、数量、备注；总价按 数量×单价 重算。仅更新本账单明细行，不影响费用表。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-line-unit-price">单价</Label>
              <Input
                id="edit-line-unit-price"
                type="number"
                min={isPenaltyInvoice ? undefined : 0}
                step="any"
                value={editUnitPrice}
                onChange={(e) => setEditUnitPrice(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-line-qty">数量</Label>
              <Input
                id="edit-line-qty"
                type="number"
                min={0.0001}
                step="any"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-line-notes">备注</Label>
              <Textarea
                id="edit-line-notes"
                value={editLineNotes}
                onChange={(e) => setEditLineNotes(e.target.value)}
                placeholder="如：分仓占比 30%"
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditLineOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="button" onClick={saveEditLine} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={issuedDialogOpen}
        onOpenChange={(open) => {
          if (!open && statusSaving !== "issued") setIssuedDialogOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改发票日期</DialogTitle>
            <DialogDescription>
              如果本账单不是第一次开票，请勿修改。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="issued-invoice-date">发票日期</Label>
            <Input
              id="issued-invoice-date"
              type="date"
              value={issuedDateInput}
              onChange={(e) => setIssuedDateInput(e.target.value)}
              disabled={statusSaving === "issued"}
            />
            <p className="text-xs text-muted-foreground">
              确认后将把账单设为「已开票」，并以上述日期写入发票日期（影响应收到期日等）。
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIssuedDialogOpen(false)}
              disabled={statusSaving === "issued"}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void confirmIssuedWithDate()}
              disabled={statusSaving === "issued"}
            >
              {statusSaving === "issued" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中
                </>
              ) : (
                "确认已开票"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
