"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

const STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  issued: "已开票",
  void: "作废",
}

interface LineRow {
  id: string | number
  fee_id: string | number
  fee_code?: string
  fee_name?: string
  unit?: string
  unit_price: number
  quantity: number
  total_amount: number
  currency?: string
}

interface DirectDeliveryBillDetailClientProps {
  invoiceId: string
  invoice: {
    invoice_id: string | number
    invoice_number?: string
    invoice_date?: string
    status?: string
    total_amount?: number
    currency?: string
    notes?: string | null
    customers?: { code?: string; name?: string } | null
    orders?: { order_number?: string } | null
  }
}

export function DirectDeliveryBillDetailClient({
  invoiceId,
  invoice,
}: DirectDeliveryBillDetailClientProps) {
  const router = useRouter()
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
    is_active?: boolean
  } | null>(null)
  const [quantity, setQuantity] = React.useState("1")
  const [submitting, setSubmitting] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | number | null>(null)
  const [editQuantity, setEditQuantity] = React.useState("")

  const loadLines = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/lines`)
      if (!res.ok) throw new Error("加载明细失败")
      const data = await res.json()
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

  const searchFees = React.useCallback(async () => {
    if (!feeSearch.trim()) {
      setFeeResults([])
      return
    }
    setFeeLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("search", feeSearch.trim())
      params.set("unlimited", "true")
      const res = await fetch(`/api/finance/fees?${params.toString()}`)
      if (!res.ok) throw new Error("搜索费用失败")
      const data = await res.json()
      setFeeResults(data.data ?? data.items ?? [])
    } catch (e: any) {
      toast.error(e?.message ?? "搜索失败")
      setFeeResults([])
    } finally {
      setFeeLoading(false)
    }
  }, [feeSearch])

  React.useEffect(() => {
    const t = setTimeout(searchFees, 300)
    return () => clearTimeout(t)
  }, [feeSearch, searchFees])

  const openAdd = () => {
    setAddOpen(true)
    setFeeSearch("")
    setFeeResults([])
    setSelectedFee(null)
    setQuantity("1")
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
    setSubmitting(true)
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee_id: selectedFee.id, quantity: q }),
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

  const updateLineQuantity = async (lineId: string | number) => {
    const q = parseFloat(editQuantity)
    if (Number.isNaN(q) || q <= 0) {
      toast.error("数量必须大于 0")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/finance/invoices/${invoiceId}/lines/${lineId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: q }) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? "更新失败")
      }
      toast.success("已更新")
      setEditingId(null)
      loadLines()
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "更新失败")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteLine = async (lineId: string | number) => {
    if (!confirm("确定删除该明细？")) return
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/finance/invoices/${invoiceId}/lines/${lineId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? "删除失败")
      }
      toast.success("已删除")
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
  const total = selectedFee && quantity ? (parseFloat(quantity) || 0) * Number(selectedFee.unit_price) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/finance/bills/direct-delivery">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">直送账单 - {invoice.invoice_number ?? invoiceId}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>主行信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span className="text-muted-foreground">发票号</span>
            <span>{invoice.invoice_number ?? "-"}</span>
            <span className="text-muted-foreground">客户</span>
            <span>{customerLabel}</span>
            <span className="text-muted-foreground">订单号</span>
            <span>{orderLabel}</span>
            <span className="text-muted-foreground">开票日期</span>
            <span>{invoice.invoice_date ? String(invoice.invoice_date).slice(0, 10) : "-"}</span>
            <span className="text-muted-foreground">状态</span>
            <span>
              <Badge variant="secondary">{STATUS_MAP[invoice.status ?? ""] ?? invoice.status}</Badge>
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
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加明细
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">暂无明细，点击「添加明细」从费用管理选择费用并填写数量。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>费用编码</TableHead>
                  <TableHead>费用名称</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.fee_code ?? "-"}</TableCell>
                    <TableCell>{line.fee_name ?? "-"}</TableCell>
                    <TableCell>{line.unit ?? "-"}</TableCell>
                    <TableCell className="text-right">{Number(line.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {editingId === line.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0.0001}
                            step="any"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-24 h-8 text-right"
                          />
                          <Button size="sm" variant="ghost" onClick={() => updateLineQuantity(line.id)} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                        </div>
                      ) : (
                        <span>{Number(line.quantity)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{Number(line.total_amount).toFixed(2)} {line.currency ?? ""}</TableCell>
                    <TableCell>
                      {editingId === line.id ? null : (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(line.id)
                              setEditQuantity(String(line.quantity))
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteLine(line.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
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
              按费用编码模糊搜索费用，选择一条后填写数量，总价 = 数量 × 单价
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>搜索费用编码</Label>
              <Input
                placeholder="输入费用编码或名称"
                value={feeSearch}
                onChange={(e) => setFeeSearch(e.target.value)}
              />
            </div>
            {feeLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 搜索中...
              </div>
            )}
            {feeResults.length > 0 && !selectedFee && (
              <div className="border rounded-md overflow-auto max-h-48">
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
                      <TableHead>启用</TableHead>
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
                        <TableCell>{f.is_active ? "是" : "否"}</TableCell>
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
                                is_active: f.is_active,
                              })
                              setFeeResults([])
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
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">已选费用：{selectedFee.fee_code} - {selectedFee.fee_name}，单价 {Number(selectedFee.unit_price).toFixed(2)} {selectedFee.currency ?? "USD"}</p>
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <Label>数量</Label>
                    <Input
                      type="number"
                      min={0.0001}
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="pt-6 text-sm">
                    总价 = {total.toFixed(2)} {selectedFee.currency ?? "USD"}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedFee(null); setQuantity("1") }}>
                    重选
                  </Button>
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
    </div>
  )
}
