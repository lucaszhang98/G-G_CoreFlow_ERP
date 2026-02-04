"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil } from "lucide-react"
import { FuzzySearchSelect } from "@/components/ui/fuzzy-search-select"

interface FeeScopeCardProps {
  feeId: string
}

interface ScopeRow {
  id: string | number
  customer_id: string | number
  customers?: { id: string | number; code: string; name: string }
}

interface FeeInfo {
  scope_type: string
}

export function FeeScopeCard({ feeId }: FeeScopeCardProps) {
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null)
  const [scopeRows, setScopeRows] = useState<ScopeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [customerOptions, setCustomerOptions] = useState<Array<{ label: string; value: string }>>([])

  const fetchFeeDetail = async () => {
    try {
      const res = await fetch(`/api/finance/fees/${feeId}`)
      if (!res.ok) return null
      const json = await res.json()
      return json.data || json
    } catch {
      return null
    }
  }

  const fetchScope = async () => {
    try {
      const res = await fetch(`/api/finance/fees/${feeId}/scope`)
      if (!res.ok) return { data: [], scope_type: "all" }
      const json = await res.json()
      return { data: json.data || [], scope_type: json.scope_type || "all" }
    } catch {
      return { data: [], scope_type: "all" }
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?limit=500")
      if (!res.ok) return []
      const json = await res.json()
      const list = json.data || json.items || []
      return list.map((c: any) => ({
        label: `${c.code || ""} ${c.name || ""}`.trim() || String(c.id),
        value: String(c.id),
      }))
    } catch {
      return []
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [detail, scopeResult] = await Promise.all([
        fetchFeeDetail(),
        fetchScope(),
      ])
      if (cancelled) return
      if (detail) setFeeInfo({ scope_type: detail.scope_type || "all" })
      setScopeRows(scopeResult.data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [feeId])

  const isCustomersScope = feeInfo?.scope_type === "customers"

  const openEdit = async () => {
    const opts = await fetchCustomers()
    setCustomerOptions(opts)
    setSelectedCustomerIds(scopeRows.map((r) => String(r.customer_id)))
    setEditOpen(true)
  }

  const saveScope = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/finance/fees/${feeId}/scope`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_ids: selectedCustomerIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n)),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error(json.error || "保存失败")
        setSaving(false)
        return
      }
      setScopeRows(json.data || [])
      setEditOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>归属范围</CardTitle>
          <CardDescription>该费用适用的客户范围</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>归属范围</CardTitle>
          <CardDescription>该费用适用的客户范围</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isCustomersScope && (
            <p className="text-sm text-muted-foreground">
              当前为「所有客户」，该费用对所有客户生效。若需为指定客户设置不同单价，请在列表中新建一条同费用编码、归属为「指定客户」的费用，并在此处维护客户范围。
            </p>
          )}
          {isCustomersScope && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">以下客户使用本费用报价</p>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  编辑归属
                </Button>
              </div>
              {scopeRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂未指定客户，请点击「编辑归属」添加</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scopeRows.map((row) => (
                    <Badge key={String(row.id)} variant="secondary">
                      {row.customers ? `${row.customers.code} ${row.customers.name}`.trim() : `客户 #${row.customer_id}`}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑归属客户</DialogTitle>
            <DialogDescription>选择使用本费用报价的客户；已选客户会从同费用编码下其他费用的范围中移除</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <FuzzySearchSelect
              options={customerOptions}
              value={selectedCustomerIds}
              onChange={(v) => setSelectedCustomerIds(Array.isArray(v) ? v : [v])}
              placeholder="搜索并选择客户"
              multiple
              emptyMessage="无匹配客户"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={saveScope} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
