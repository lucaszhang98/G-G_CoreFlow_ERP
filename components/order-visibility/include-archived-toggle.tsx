"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/** 列表请求加 `includeArchived=true` 时展示完成留档、已取消等历史订单；默认关闭 */
export function IncludeArchivedOrdersToggle({
  checked,
  onCheckedChange,
  id = "include-archived-orders",
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  id?: string
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer whitespace-nowrap">
        显示归档/已取消（历史）
      </Label>
    </div>
  )
}
