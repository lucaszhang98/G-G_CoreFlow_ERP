"use client"

import { useEffect, useState } from "react"
import { Warehouse } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type WarehouseOption = {
  warehouse_id: string
  warehouse_code: string | null
  name: string
}

const ALL = "all"

/**
 * 顶部「当前仓库」切换器：仅用户名 admin 可见。
 * 切换后写 cookie 并整页刷新，使所有列表/统计按新仓库重新拉取。
 */
export function WarehouseSwitcher() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [current, setCurrent] = useState<string>("")
  const [canSwitchWarehouse, setCanSwitchWarehouse] = useState(false)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/warehouse/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return
        setCanSwitchWarehouse(!!d.canSwitchWarehouse)
        setWarehouses(d.warehouses || [])
        setCurrent(d.currentWarehouseId || "")
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const onChange = async (value: string) => {
    if (value === current) return
    setSwitching(true)
    try {
      const res = await fetch("/api/warehouse/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: value }),
      })
      if (!res.ok) throw new Error()
      setCurrent(value)
      // 全局生效：刷新整页以按新仓库重新拉取所有数据
      window.location.reload()
    } catch {
      toast.error("切换仓库失败")
      setSwitching(false)
    }
  }

  // 无切仓权限（warehouses 为空）或加载中：不显示切换器
  if (loading || !canSwitchWarehouse || warehouses.length === 0) return null

  return (
    <Select value={current} onValueChange={onChange} disabled={switching}>
      <SelectTrigger className="h-9 w-[150px] sm:w-[180px]">
        <div className="flex items-center gap-2 min-w-0">
          <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="选择仓库" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {warehouses.map((w) => (
          <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
            {w.name}
            {w.warehouse_code ? ` (${w.warehouse_code})` : ""}
          </SelectItem>
        ))}
        <SelectItem value={ALL}>全部仓库</SelectItem>
      </SelectContent>
    </Select>
  )
}
