"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type RemainingPalletsRow = {
  id: string
  inventory_lot_id?: string | null
  remaining_pallets?: number | null
}

function parseRemainingInput(trimmed: string): number | "INVALID" {
  if (trimmed === "") return "INVALID"
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n)) return "INVALID"
  return n
}

/**
 * 订单明细列表「剩余板数」：仅改本页草稿，与未约快照一并批量保存并标记已校验。
 */
export function RemainingPalletsInlineCell({
  row,
  draft,
  onEnsureDraft,
  onRemainingChange,
}: {
  row: RemainingPalletsRow
  draft: { remaining: number; unbooked: number } | null
  onEnsureDraft: () => void
  onRemainingChange: (value: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [localDraft, setLocalDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const lotId = row.inventory_lot_id
  const displayVal =
    draft != null
      ? draft.remaining
      : row.remaining_pallets != null
        ? Math.round(Number(row.remaining_pallets))
        : null
  const canEdit = Boolean(lotId)

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    if (!canEdit) {
      toast.error("未入库无库存批次，无法修改剩余板数")
      return
    }
    onEnsureDraft()
    setLocalDraft(displayVal !== null && !Number.isNaN(displayVal) ? String(displayVal) : "0")
    setEditing(true)
  }

  const commitLocal = () => {
    const parsed = parseRemainingInput(localDraft.trim())
    if (parsed === "INVALID") {
      toast.error("请输入整数剩余板数")
      return
    }
    onRemainingChange(parsed)
    setEditing(false)
  }

  const displayText =
    displayVal !== null && !Number.isNaN(displayVal) ? displayVal.toLocaleString() : "—"

  if (!canEdit) {
    return (
      <div className="text-muted-foreground tabular-nums" title="无库存批次">
        {displayText}
      </div>
    )
  }

  if (editing) {
    return (
      <div className="min-w-[5.5rem]" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="剩余板数"
          className={cn("h-8 tabular-nums text-right")}
          value={localDraft}
          onChange={(e) => {
            const v = e.target.value
            if (v === "" || v === "-") {
              setLocalDraft(v)
              return
            }
            if (/^-?\d*$/.test(v)) setLocalDraft(v)
          }}
          onBlur={() => commitLocal()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === "Escape") {
              e.preventDefault()
              setEditing(false)
              setLocalDraft("")
            }
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full text-right tabular-nums rounded px-1.5 py-0.5 -mx-1.5 min-h-8",
        "hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      )}
      title="点击编辑剩余板数（需点「保存本页修改」写入数据库）"
      onClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
    >
      {displayText}
    </button>
  )
}
